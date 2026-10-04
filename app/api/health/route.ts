import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { checkPythonService } from "@/lib/matching/python";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — unauthenticated liveness/readiness probe.
 *
 * This route is unauthenticated on purpose so that uptime monitors and
 * container orchestrators can poll it without a session: it is deliberately
 * absent from `PROTECTED_PREFIXES` in `auth.config.ts`, so the middleware gate
 * lets it through (see `middleware.ts`). It therefore must never expose
 * anything sensitive — only coarse status flags and the public engine weights.
 *
 * Always answers, even when the database is unreachable — a probe that hangs or
 * throws is useless. A failing database reports `503 degraded`; an unreachable
 * *optional* Python service does not, because the application degrades to its
 * own TypeScript engine and stays fully functional.
 */

/** A database that has not answered within this window is reported as down. */
const DB_PING_TIMEOUT_MS = 5000;

type DatabaseStatus = "up" | "down" | "not-configured";

async function databaseStatus(): Promise<DatabaseStatus> {
  if (!isDatabaseConfigured()) return "not-configured";

  try {
    await connectDB();
    const admin = mongoose.connection.db?.admin();
    if (!admin) return "down";

    await Promise.race([
      admin.ping(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("database ping timed out")), DB_PING_TIMEOUT_MS)
      ),
    ]);

    return "up";
  } catch {
    return "down";
  }
}

export async function GET() {
  const [database, python] = await Promise.all([
    databaseStatus(),
    checkPythonService(),
  ]);

  const healthy = database !== "down";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        // Which engine will actually answer a scoring request right now.
        matchingEngine: python.reachable ? "python" : "typescript",
      },
      pythonService: python,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
