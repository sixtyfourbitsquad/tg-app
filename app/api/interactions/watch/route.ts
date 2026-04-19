import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getFingerprint } from "@/lib/fingerprint";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  video_id: z.string().min(1),
  watch_time: z.number().int().min(0),
  completed: z.boolean(),
});

export async function POST(req: NextRequest) {
  const fp = getFingerprint(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { video_id, watch_time, completed } = parsed.data;

  const video = await db.video.findUnique({ where: { id: video_id } });
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
      data: { user_id: user.id, video_id, watch_time, completed },
    }),
    // Increment view count
    db.video.update({
      where: { id: video_id },
      data: { views: { increment: 1 } },
    }),
  ]);

  logger.info("Watch event recorded", { video_id, watch_time, completed });
  return NextResponse.json({ ok: true });
}
