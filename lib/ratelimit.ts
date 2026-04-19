import { NextRequest, NextResponse } from "next/server";
import { redis } from "./redis";
import { logger } from "./logger";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

/**
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 * Uses a fixed 60-second sliding window per IP.
 */
export async function rateLimit(req: NextRequest): Promise<NextResponse | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `ratelimit:${ip}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_REQUESTS) {
      logger.warn("Rate limit exceeded", { ip, count });
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Retry-After": String(WINDOW_SECONDS),
            "X-RateLimit-Limit": String(MAX_REQUESTS),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    return null;
  } catch {
    // Redis unavailable — fail open (don't block the request)
    return null;
  }
}
