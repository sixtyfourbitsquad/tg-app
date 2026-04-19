import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { resolveUser } from "@/lib/user";
import type { CommentDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

const PostSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export async function GET(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;
  const video = await db.video.findUnique({ where: { id: videoId }, select: { id: true } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  const [rows, total] = await Promise.all([
    db.comment.findMany({
      where: { video_id: videoId },
      orderBy: { created_at: "desc" },
      take: 80,
      include: { user: { select: { username: true } } },
    }),
    db.comment.count({ where: { video_id: videoId } }),
  ]);

  const comments: CommentDTO[] = rows.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at.toISOString(),
    author: c.user.username ? `@${c.user.username}` : "User",
  }));

  return NextResponse.json({ comments, total });
}

export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimit(req);
  if (limited) return limited;

  const { id: videoId } = await params;
  const video = await db.video.findUnique({ where: { id: videoId }, select: { id: true } });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await resolveUser(req);
  const created = await db.comment.create({
    data: { video_id: videoId, user_id: user.id, body: parsed.data.body },
    include: { user: { select: { username: true } } },
  });

  const dto: CommentDTO = {
    id: created.id,
    body: created.body,
    created_at: created.created_at.toISOString(),
    author: created.user.username ? `@${created.user.username}` : "User",
  };

  return NextResponse.json({ comment: dto });
}
