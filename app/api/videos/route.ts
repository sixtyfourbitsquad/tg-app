import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getFingerprint } from "@/lib/fingerprint";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import type { FeedResponse, VideoDTO } from "@/types";

const QuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { category, cursor, limit } = parsed.data;
  const cacheKey = `videos:${category ?? "all"}:${cursor ?? "initial"}`;

  try {
    if (cursor) {
      const cached = await cacheGet<FeedResponse>(cacheKey);
      if (cached) {
        logger.debug("Feed cache hit", { cacheKey });
        return NextResponse.json(cached);
      }
    }

    const fp = getFingerprint(req);
    const where = category ? { category: { slug: category } } : {};

    // Cursor: use created_at for keyset pagination
    const cursorFilter = cursor
      ? { created_at: { lt: new Date(cursor) } }
      : {};

    const isInitialLoad = !cursor;
    const fetchCount = isInitialLoad ? Math.min(limit * 5, 100) : limit + 1;

    const rawVideos = await db.video.findMany({
      where: { ...where, ...cursorFilter },
      orderBy: { created_at: "desc" },
      take: fetchCount,
      include: { category: true },
    });

    let pageVideos;
    let hasMore: boolean;
    let nextCursor: string | null;

    if (isInitialLoad) {
      // Shuffle for random feed on every refresh
      const shuffled = rawVideos.sort(() => Math.random() - 0.5);
      pageVideos = shuffled.slice(0, limit);
      hasMore = rawVideos.length >= limit * 2;
      nextCursor = hasMore ? pageVideos[pageVideos.length - 1].created_at.toISOString() : null;
    } else {
      hasMore = rawVideos.length > limit;
      pageVideos = hasMore ? rawVideos.slice(0, limit) : rawVideos;
      nextCursor = hasMore ? pageVideos[pageVideos.length - 1].created_at.toISOString() : null;
    }

    // Interaction state for this user
    const user = await db.user.findUnique({ where: { ip_fingerprint: fp } });
    const videoIds = pageVideos.map((v) => v.id);
    let likedSet = new Set<string>();
    let savedSet = new Set<string>();

    if (user) {
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

    // Count likes/saves per video
    const [likeCounts, saveCounts] = await Promise.all([
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
    ]);

    const likeMap = Object.fromEntries(
      likeCounts.map((r) => [r.video_id, r._count.video_id])
    );
    const saveMap = Object.fromEntries(
      saveCounts.map((r) => [r.video_id, r._count.video_id])
    );

    const videos: VideoDTO[] = pageVideos.map((v) => ({
      id: v.id,
      url: v.url,
      thumbnail: v.thumbnail,
      title: v.title,
      category: { id: v.category.id, name: v.category.name, slug: v.category.slug },
      duration: v.duration,
      views: v.views,
      like_count: likeMap[v.id] ?? 0,
      save_count: saveMap[v.id] ?? 0,
      reddit_id: v.reddit_id,
      created_at: v.created_at.toISOString(),
      liked: likedSet.has(v.id),
      saved: savedSet.has(v.id),
    }));

    const response: FeedResponse = { videos, nextCursor, hasMore };

    if (cursor) await cacheSet(cacheKey, response, 300);
    logger.info("Feed served", { category, cursor, count: videos.length });
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("GET /api/videos failed", { err: message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
