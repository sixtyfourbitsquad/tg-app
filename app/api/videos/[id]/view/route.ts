import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getFingerprint } from "@/lib/fingerprint";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  watch_time: z.number().int().min(0),
  completed: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;
  const fp = getFingerprint(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { watch_time, completed } = parsed.data;

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

    await Promise.all([
      db.watchEvent.create({
        data: {
          user_id: user.id,
          video_id: videoId,
          watch_time,
          completed,
        },
      }),
      db.video.update({
        where: { id: videoId },
        data: { views: { increment: 1 } },
      }),
    ]);

    logger.info("View recorded", { videoId, watch_time, completed });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("POST /api/videos/[id]/view failed", { err: message, videoId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
