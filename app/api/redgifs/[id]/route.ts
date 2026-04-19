import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { logger } from "@/lib/logger";

const REDGIFS_API = "https://api.redgifs.com/v2";

async function fetchToken(): Promise<string> {
  const res = await fetch(`${REDGIFS_API}/auth/temporary`);
  const data = await res.json();
  return data.token as string;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cached = await cacheGet<string>("redgifs:token");
    if (cached) return cached;
  }
  const token = await fetchToken();
  await cacheSet("redgifs:token", token, 3600);
  return token;
}

async function getGifUrl(id: string, token: string): Promise<string> {
  const cached = await cacheGet<string>(`redgifs:url:${id}`);
  if (cached) return cached;

  const res = await fetch(`${REDGIFS_API}/gifs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Redgifs API ${res.status}`);

  const data = await res.json();
  const gif = data.gif ?? data;
  const url: string = gif?.urls?.hd ?? gif?.urls?.sd ?? "";
  if (url) await cacheSet(`redgifs:url:${id}`, url, 1800);
  return url;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let token = await getToken();
    let videoUrl: string;

    try {
      videoUrl = await getGifUrl(id, token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Token expired — refresh and retry once
      if (msg.includes("401") || msg.includes("403")) {
        await cacheDel("redgifs:token");
        token = await getToken(true);
        videoUrl = await getGifUrl(id, token);
      } else {
        throw err;
      }
    }

    if (!videoUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const range = req.headers.get("range");
    if (range) reqHeaders["Range"] = range;

    const upstream = await fetch(videoUrl, { headers: reqHeaders });

    const resHeaders: Record<string, string> = {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=1800",
    };
    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");
    if (cl) resHeaders["Content-Length"] = cl;
    if (cr) resHeaders["Content-Range"] = cr;

    logger.info("Streaming video", { id, status: upstream.status });
    return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Redgifs proxy failed", { id, err: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
