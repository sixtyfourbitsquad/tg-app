import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import type { AnalyticsDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;
  const cacheKey = `analytics:${videoId}`;

  try {
    const cached = await cacheGet<AnalyticsDTO>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const video = await db.video.findUnique({ where: { id: videoId } });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Date range: last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const events = await db.watchEvent.findMany({
      where: {
        video_id: videoId,
        created_at: { gte: sevenDaysAgo },
      },
      select: { watch_time: true, completed: true, created_at: true },
    });

    const totalViews = video.views;
    const avgWatchTime =
      events.length > 0
        ? Math.round(events.reduce((sum, e) => sum + e.watch_time, 0) / events.length)
        : 0;
    const completedCount = events.filter((e) => e.completed).length;
    const completionRate =
      events.length > 0
        ? Math.round((completedCount / events.length) * 100)
        : 0;

    // Group by day (ISO date string)
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const e of events) {
      const day = e.created_at.toISOString().slice(0, 10);
      if (day in dayMap) dayMap[day]++;
    }

    const views_per_day = Object.entries(dayMap).map(([date, views]) => ({
      date,
      views,
    }));

    const data: AnalyticsDTO = {
      video_id: videoId,
      total_views: totalViews,
      avg_watch_time: avgWatchTime,
      completion_rate: completionRate,
      views_per_day,
    };

    await cacheSet(cacheKey, data, 300); // 5 min TTL
    logger.debug("Analytics served", { videoId });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("GET /api/analytics/[id] failed", { err: message, videoId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
