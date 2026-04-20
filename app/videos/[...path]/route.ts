import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import { Readable } from "node:stream";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve ROOT per-request instead of at module scope so that env var changes
// (docker compose env updates, k8s config reload, …) take effect without a
// full rebuild. `resolve()` is cheap; doing it on every request is fine.
function videosRoot(): string {
  return resolve(process.env.VIDEOS_DIR ?? "/home/adii/videos");
}
const MAX_AGE_SEC = 3600;

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/mp4",
};

function resolveSafe(root: string, parts: string[]): string | null {
  const joined = join(root, ...parts);
  const abs = resolve(joined);
  if (!abs.startsWith(root + "/") && abs !== root) return null;
  return abs;
}

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;
  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= size) return null;
  return { start, end };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!Array.isArray(path) || path.length === 0) {
    logger.warn("videos route: empty path", { path });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const root = videosRoot();
  const abs = resolveSafe(root, path);
  if (!abs) {
    logger.warn("videos route: resolveSafe rejected", { root, path });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let stat;
  try {
    stat = statSync(abs);
    if (!stat.isFile()) throw new Error("not a file");
  } catch (err) {
    logger.warn("videos route: stat failed", {
      root,
      abs,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const size = stat.size;
  const type = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = parseRange(req.headers.get("range"), size);

  const baseHeaders: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": `public, max-age=${MAX_AGE_SEC}`,
    "Last-Modified": stat.mtime.toUTCString(),
  };

  if (range) {
    const { start, end } = range;
    const length = end - start + 1;
    const nodeStream = createReadStream(abs, { start, end });
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
    logger.debug("Serving video (range)", { abs, start, end, size });
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(length),
      },
    });
  }

  const nodeStream = createReadStream(abs);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
  logger.debug("Serving video (full)", { abs, size });
  return new NextResponse(webStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}

export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const abs = resolveSafe(videosRoot(), path);
  if (!abs) return new NextResponse(null, { status: 404 });
  try {
    const stat = statSync(abs);
    if (!stat.isFile()) throw new Error("not a file");
    const type = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": `public, max-age=${MAX_AGE_SEC}`,
        "Last-Modified": stat.mtime.toUTCString(),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
