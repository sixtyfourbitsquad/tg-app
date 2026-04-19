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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = await getToken();
    const { data } = await axios.get(
      `${REDGIFS_API}/gifs/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    logger.info("Redgifs gif response", { id, keys: Object.keys(data) });
    const gif = data.gif ?? data;
    const url = gif?.urls?.hd ?? gif?.urls?.sd ?? "";
    logger.info("Resolved video URL", { id, url: url.slice(0, 80) });
    if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Redgifs proxy failed", { id, err: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
