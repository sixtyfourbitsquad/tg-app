import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFingerprint } from "@/lib/fingerprint";
import { cacheSet, cacheGet } from "@/lib/redis";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// POST /api/auth/connect → generate a code tied to this session
export async function POST(req: NextRequest) {
  const fp = getFingerprint(req);

  // Find or create anonymous user
  let user = await db.user.findUnique({ where: { ip_fingerprint: fp } });
  if (!user) {
    user = await db.user.create({ data: { ip_fingerprint: fp } });
  }

  const code = generateCode();
  // Store code → user_id for 10 minutes
  await cacheSet(`connect:${code}`, user.id, 600);

  return NextResponse.json({ code });
}

// GET /api/auth/connect?code=XX → used by bot to resolve code
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const userId = await cacheGet<string>(`connect:${code}`);
  if (!userId) return NextResponse.json({ error: "Invalid or expired code" }, { status: 404 });

  return NextResponse.json({ user_id: userId });
}
