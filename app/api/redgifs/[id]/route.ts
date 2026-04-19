import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cacheGet, cacheSet } from "@/lib/redis";
import { logger } from "@/lib/logger";

const REDGIFS_API = "https://api.redgifs.com/v2";

async function getToken(): Promise<string> {
  const cached = await cacheGet<string>("redgifs:token");
  if (cached) return cached;
  const { data } = await axios.get<{ token: string }>(`${REDGIFS_API}/auth/temporary`);
  await cacheSet("redgifs:token", data.token, 3600);
  return data.token;
}

async function getGifUrl(id: string, token: string): Promise<string> {
  const cached = await cacheGet<string>(`redgifs:url:${id}`);
  if (cached) return cached;
  const { data } = await axios.get(`${REDGIFS_API}/gifs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const gif = data.gif ?? data;
  const url: string = gif?.urls?.hd ?? gif?.urls?.sd ?? "";
  if (url) await cacheSet(`redgifs:url:${id}`, url, 1800); // cache 30 min
  return url;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = await getToken();
    const videoUrl = await getGifUrl(id, token);
    if (!videoUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const range = req.headers.get("range") ?? undefined;
    const upstream = await axios.get<import("stream").Readable>(videoUrl, {
      responseType: "stream",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(range ? { Range: range } : {}),
      },
      validateStatus: () => true,
    });

    const headers: Record<string, string> = {
      "Content-Type": (upstream.headers["content-type"] as string) || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };
    if (upstream.headers["content-length"])
      headers["Content-Length"] = upstream.headers["content-length"] as string;
    if (upstream.headers["content-range"])
      headers["Content-Range"] = upstream.headers["content-range"] as string;

    const readable = upstream.data as unknown as ReadableStream;
    logger.info("Streaming video", { id, status: upstream.status });
    return new NextResponse(readable, { status: upstream.status, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Redgifs proxy failed", { id, err: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
