import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { cacheGet, cacheSet } from "@/lib/redis";

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
    const { data } = await axios.get<{ gif: { urls: { hd?: string; sd?: string } } }>(
      `${REDGIFS_API}/gifs/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const url = data.gif?.urls?.hd ?? data.gif?.urls?.sd ?? "";
    if (!url) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Failed to fetch video" }, { status: 502 });
  }
}
