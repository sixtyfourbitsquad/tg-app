import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { resolveUser } from "@/lib/user";
import type { VideoDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: { category: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const user = await resolveUser(req);

  const [liked, saved, likeCount, saveCount] = await Promise.all([
    db.like.findUnique({
      where: { user_id_video_id: { user_id: user.id, video_id: videoId } },
    }),
    db.save.findUnique({
      where: { user_id_video_id: { user_id: user.id, video_id: videoId } },
    }),
    db.like.count({ where: { video_id: videoId } }),
    db.save.count({ where: { video_id: videoId } }),
  ]);

  const dto: VideoDTO = {
    id: video.id,
    url: video.url,
    thumbnail: video.thumbnail,
    title: video.title,
    category: {
      id: video.category.id,
      name: video.category.name,
      slug: video.category.slug,
    },
    duration: video.duration,
    views: video.views,
    like_count: likeCount,
    save_count: saveCount,
    reddit_id: video.reddit_id,
    created_at: video.created_at.toISOString(),
    liked: !!liked,
    saved: !!saved,
  };

  return NextResponse.json(dto);
}
