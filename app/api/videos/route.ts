import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import { resolveUser } from "@/lib/user";
import { logger } from "@/lib/logger";
import type { FeedResponse, VideoDTO } from "@/types";

const QuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["random", "trending"]).default("random"),
  seed: z.string().min(1).max(64).optional(),
});

type VideoRow = {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  file_path: string;
  file_size: bigint;
  original_filename: string;
  duration: number;
  views: number;
  created_at: Date;
};

function randomSeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseOffset(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = Number.parseInt(cursor, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { cursor, limit, sort } = parsed.data;
  const seed = sort === "random" ? parsed.data.seed ?? randomSeed() : "";
  const offset = parseOffset(cursor);

  // Cache is keyed on the exact slice so different sessions (different seeds)
  // do not collide and trending stays shared across users.
  const cacheKey = `videos:${sort}:${seed}:${offset}`;

  try {
    if (offset > 0) {
      const cached = await cacheGet<FeedResponse>(cacheKey);
      if (cached) {
        logger.debug("Feed cache hit", { cacheKey });
        return NextResponse.json(cached);
      }
    }

    const fetchCount = limit + 1;
    let rawVideos: VideoRow[];

    if (sort === "trending") {
      rawVideos = (await db.video.findMany({
        orderBy: [{ views: "desc" }, { id: "asc" }],
        skip: offset,
        take: fetchCount,
      })) as VideoRow[];
    } else {
      // Seeded deterministic shuffle: hashing (id || seed) yields a stable
      // "random" order unique to this session while still paginable via OFFSET.
      rawVideos = await db.$queryRaw<VideoRow[]>`
        SELECT id, url, thumbnail, title, file_path, file_size,
               original_filename, duration, views, created_at
        FROM videos
        ORDER BY md5(id || ${seed})
        LIMIT ${fetchCount}
        OFFSET ${offset}
      `;
    }

    const hasMore = rawVideos.length > limit;
    const pageVideos = hasMore ? rawVideos.slice(0, limit) : rawVideos;
    const nextCursor = hasMore ? String(offset + limit) : null;

    // Interaction state for this user (Telegram cookie/header or fingerprint)
    const user = await resolveUser(req);
    const videoIds = pageVideos.map((v) => v.id);
    let likedSet = new Set<string>();
    let savedSet = new Set<string>();

    if (user && videoIds.length > 0) {
      const [likes, saves] = await Promise.all([
        db.like.findMany({
          where: { user_id: user.id, video_id: { in: videoIds } },
          select: { video_id: true },
        }),
        db.save.findMany({
          where: { user_id: user.id, video_id: { in: videoIds } },
          select: { video_id: true },
        }),
      ]);
      likedSet = new Set(likes.map((l) => l.video_id));
      savedSet = new Set(saves.map((s) => s.video_id));
    }

    const [likeCounts, saveCounts] = videoIds.length > 0
      ? await Promise.all([
          db.like.groupBy({
            by: ["video_id"],
            where: { video_id: { in: videoIds } },
            _count: { video_id: true },
          }),
          db.save.groupBy({
            by: ["video_id"],
            where: { video_id: { in: videoIds } },
            _count: { video_id: true },
          }),
        ])
      : [[], []];

    const likeMap = Object.fromEntries(
      likeCounts.map((r) => [r.video_id, r._count.video_id]),
    );
    const saveMap = Object.fromEntries(
      saveCounts.map((r) => [r.video_id, r._count.video_id]),
    );

    const videos: VideoDTO[] = pageVideos.map((v) => ({
      id: v.id,
      url: v.url,
      thumbnail: v.thumbnail,
      title: v.title,
      file_size: v.file_size.toString(),
      original_filename: v.original_filename,
      duration: v.duration,
      views: v.views,
      like_count: likeMap[v.id] ?? 0,
      save_count: saveMap[v.id] ?? 0,
      created_at: v.created_at.toISOString(),
      liked: likedSet.has(v.id),
      saved: savedSet.has(v.id),
    }));

    const response: FeedResponse = { videos, nextCursor, hasMore, seed };

    if (offset > 0) await cacheSet(cacheKey, response, 300);
    logger.info("Feed served", { sort, offset, count: videos.length });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("GET /api/videos failed", { err: message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
