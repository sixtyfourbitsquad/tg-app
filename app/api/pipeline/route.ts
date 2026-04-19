import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Protect with a shared secret to prevent public triggering
function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-pipeline-token");
  return token === process.env.NEXTAUTH_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Import pipeline runner lazily to avoid loading ffmpeg on every request
  try {
    const { runPipeline } = await import("@/pipeline/runner");
    const result = await runPipeline();

    logger.info("Pipeline triggered via API", result);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Pipeline API trigger failed", { err: message });

    await db.pipelineLog.create({
      data: { status: "failed", videos_fetched: 0, errors: { message } },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await db.pipelineLog.findMany({
    orderBy: { ran_at: "desc" },
    take: 20,
  });

  return NextResponse.json(logs);
}
