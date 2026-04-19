import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Owner-only: last pipeline runs. Set `ADMIN_SECRET` and send header `x-admin-secret`. */
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return NextResponse.json({ error: "ADMIN_SECRET not configured" }, { status: 503 });

  if (req.headers.get("x-admin-secret") !== secret) return unauthorized();

  const logs = await db.pipelineLog.findMany({
    orderBy: { ran_at: "desc" },
    take: 50,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      status: l.status,
      videos_fetched: l.videos_fetched,
      errors: l.errors,
      ran_at: l.ran_at.toISOString(),
    })),
  });
}
