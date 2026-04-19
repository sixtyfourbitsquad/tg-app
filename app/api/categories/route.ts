import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/redis";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import type { CategoryDTO } from "@/types";

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const cacheKey = "categories:all";

  try {
    const cached = await cacheGet<CategoryDTO[]>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const categories = await db.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { videos: true } },
      },
    });

    const data: CategoryDTO[] = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      video_count: c._count.videos,
    }));

    await cacheSet(cacheKey, data, 3600); // 1 hour TTL
    logger.debug("Categories served", { count: data.length });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("GET /api/categories failed", { err: message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
