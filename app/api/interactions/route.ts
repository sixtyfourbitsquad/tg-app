import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { cacheDel } from "@/lib/redis";
import { getFingerprint } from "@/lib/fingerprint";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  video_id: z.string().min(1),
  action: z.enum(["like", "unlike", "save", "unsave"]),
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

  const { video_id, action } = parsed.data;

  // Upsert user
  const user = await db.user.upsert({
    where: { ip_fingerprint: fp },
    update: {},
    create: { ip_fingerprint: fp },
  });

  // Verify video exists
  const video = await db.video.findUnique({ where: { id: video_id } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  try {
    switch (action) {
      case "like":
        await db.like.upsert({
          where: { user_id_video_id: { user_id: user.id, video_id } },
          update: {},
          create: { user_id: user.id, video_id },
        });
        break;

      case "unlike":
        await db.like.deleteMany({
          where: { user_id: user.id, video_id },
        });
        break;

      case "save":
        await db.save.upsert({
          where: { user_id_video_id: { user_id: user.id, video_id } },
          update: {},
          create: { user_id: user.id, video_id },
        });
        break;

      case "unsave":
        await db.save.deleteMany({
          where: { user_id: user.id, video_id },
        });
        break;
    }

    // Invalidate video cache
    await cacheDel(`videos:all:latest:p1:pp10`);

    logger.info("Interaction recorded", { action, video_id, user_id: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Interaction failed", { err, action, video_id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
