import { NextRequest } from "next/server";
import { createHash } from "crypto";

/**
 * Derive a stable anonymous fingerprint from request headers.
 * Not a perfect identifier — good enough for anonymous session tracking.
 */
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
