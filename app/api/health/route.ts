import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

interface HealthStatus {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  services: {
    database: "ok" | "error";
    redis: "ok" | "error";
  };
  uptime: number;
}

export async function GET(_req: NextRequest) {
  const started = Date.now();

  const [dbOk, redisOk] = await Promise.all([
    db.$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false),
    redis
      .ping()
      .then((r) => r === "PONG")
      .catch(() => false),
  ]);

  const services = {
    database: dbOk ? ("ok" as const) : ("error" as const),
    redis: redisOk ? ("ok" as const) : ("error" as const),
  };

  const allOk = dbOk && redisOk;
  const anyOk = dbOk || redisOk;

  const body: HealthStatus = {
    status: allOk ? "ok" : anyOk ? "degraded" : "down",
    timestamp: new Date().toISOString(),
    services,
    uptime: process.uptime(),
  };

  const httpStatus = allOk ? 200 : anyOk ? 207 : 503;

  logger.debug("Health check", { ...body, latencyMs: Date.now() - started });
  return NextResponse.json(body, { status: httpStatus });
}
