import { z } from "zod";
import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/rbac";
import { skillGapRows } from "@/services/analyticsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  projectId: z.string().trim().optional(),
});

/**
 * GET /api/skill-gaps
 * Compares each project's requirements with the skills of its allocated team.
 */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "skillgaps:read", ...READ_LIMIT });
  const user = await requireUser();
  const query = readQuery(request, querySchema);

  const rows = await skillGapRows(user, { projectId: query.projectId });

  const summary = {
    projectsAnalysed: rows.length,
    projectsWithGaps: rows.filter((row) => row.gaps.length > 0).length,
    totalOpenGaps: rows.reduce((sum, row) => sum + row.gaps.length, 0),
    averageCoveragePercent:
      rows.length === 0
        ? 0
        : Math.round(
            (rows.reduce((sum, row) => sum + row.overallCoveragePercent, 0) / rows.length) * 10
          ) / 10,
  };

  return ok(rows, { meta: summary });
});