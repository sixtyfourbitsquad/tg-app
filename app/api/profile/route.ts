import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFingerprint, getTelegramId } from "@/lib/fingerprint";
import { rateLimit } from "@/lib/ratelimit";
import type { VideoDTO } from "@/types";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const telegramId = getTelegramId(req);
  const fp = getFingerprint(req);
  const user = telegramId
    ? await db.user.findUnique({ where: { telegram_id: telegramId } })
    : await db.user.findUnique({ where: { ip_fingerprint: fp } });

  if (!user) {
    return NextResponse.json({
      username: "Guest",
      is_premium: false,
      saved_videos: [],
      like_count: 0,
      save_count: 0,
    });
  }

  const saves = await db.save.findMany({
    where: { user_id: user.id },
    include: { video: { include: { category: true } } },
    orderBy: { video: { created_at: "desc" } },
  });

  const [likeCount, saveCount] = await Promise.all([
    db.like.count({ where: { user_id: user.id } }),
    db.save.count({ where: { user_id: user.id } }),
  ]);

  const saved_videos: VideoDTO[] = saves.map(({ video: v }) => ({
    id: v.id,
    url: v.url,
    thumbnail: v.thumbnail,
    title: v.title,
    category: { id: v.category.id, name: v.category.name, slug: v.category.slug },
    duration: v.duration,
    views: v.views,
    like_count: 0,
    save_count: 0,
    reddit_id: v.reddit_id,
    created_at: v.created_at.toISOString(),
    liked: false,
    saved: true,
  }));

  return NextResponse.json({
    username: user.username ?? "Anonymous",
    telegram_id: user.telegram_id ? String(user.telegram_id) : null,
    is_premium: user.is_premium,
    saved_videos,
    like_count: likeCount,
    save_count: saveCount,
  });
}
