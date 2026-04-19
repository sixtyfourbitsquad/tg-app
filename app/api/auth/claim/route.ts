import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFingerprint } from "@/lib/fingerprint";

/**
 * After Telegram connect, the browser may not have `tg_id` (httpOnly) yet.
 * If this fingerprint session is already linked to Telegram, set the cookie
 * so `getTelegramId()` works on subsequent requests.
 */
export async function POST(req: NextRequest) {
  const fp = getFingerprint(req);
  const user = await db.user.findUnique({ where: { ip_fingerprint: fp } });

  if (!user?.telegram_id) {
    return NextResponse.json({ linked: false });
  }

  const res = NextResponse.json({ linked: true, telegram_id: String(user.telegram_id) });
  res.cookies.set("tg_id", String(user.telegram_id), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
