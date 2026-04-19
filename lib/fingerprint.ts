import { NextRequest } from "next/server";
import { createHash } from "crypto";

export function getFingerprint(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const ua = req.headers.get("user-agent") ?? "";
  const lang = req.headers.get("accept-language") ?? "";

  return createHash("sha256")
    .update(`${ip}:${ua}:${lang}`)
    .digest("hex")
    .slice(0, 32);
}

export function getTelegramId(req: NextRequest): bigint | null {
  const fromHeader = req.headers.get("x-telegram-id");
  const fromCookie = req.cookies.get("tg_id")?.value;
  const raw = fromHeader ?? fromCookie ?? null;
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
