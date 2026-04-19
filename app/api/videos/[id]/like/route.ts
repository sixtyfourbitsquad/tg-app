import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis, cacheDel } from "@/lib/redis";
import { getFingerprint } from "@/lib/fingerprint";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import type { LikeResponse } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;
  const fp = getFingerprint(req);

  try {
    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const user = await db.user.upsert({
      where: { ip_fingerprint: fp },
      update: {},
      create: { ip_fingerprint: fp },
    });

    const existing = await db.like.findUnique({
      where: { user_id_video_id: { user_id: user.id, video_id: videoId } },
    });

    let liked: boolean;
    if (existing) {
      await db.like.delete({
        where: { user_id_video_id: { user_id: user.id, video_id: videoId } },
      });
      liked = false;
    } else {
      await db.like.create({ data: { user_id: user.id, video_id: videoId } });
      liked = true;
    }

    const count = await db.like.count({ where: { video_id: videoId } });

    // Cache the count in Redis for fast reads; invalidate feed cache
    await Promise.all([
      redis.set(`video:${videoId}:likes`, String(count), "EX", 3600),
      cacheDel(`videos:all:initial`),
    ]);

    logger.info("Like toggled", { videoId, liked, count });
    return NextResponse.json({ liked, count } satisfies LikeResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("POST /api/videos/[id]/like failed", { err: message, videoId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
