import { NextRequest, NextResponse } from "next/server";
import { createHmac, createHash } from "crypto";
import { db } from "@/lib/db";
import type { TelegramUser } from "@/lib/telegram";

function verifyTelegramInitData(initData: string, botToken: string): boolean {
  if (!initData) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return expectedHash === hash;
}

export async function POST(req: NextRequest) {
  try {
    const { initData, user }: { initData: string; user: TelegramUser } = await req.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
    const isValid = verifyTelegramInitData(initData, botToken);

    // In dev/browser testing, allow mock user through even without valid initData
    const isDev = process.env.NODE_ENV !== "production";
    if (!isValid && !isDev) {
      return NextResponse.json({ error: "Invalid initData" }, { status: 401 });
    }

    if (!user?.telegram_id) {
      return NextResponse.json({ error: "No user data" }, { status: 400 });
    }

    const dbUser = await db.user.upsert({
      where: { telegram_id: BigInt(user.telegram_id) },
      update: { username: user.username ?? null },
      create: { telegram_id: BigInt(user.telegram_id), username: user.username ?? null },
    });

    const res = NextResponse.json({
      id: dbUser.id,
      telegram_id: String(dbUser.telegram_id),
      username: dbUser.username,
      is_premium: dbUser.is_premium,
    });

    // Set telegram_id cookie for server-side identification
    res.cookies.set("tg_id", String(user.telegram_id), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
