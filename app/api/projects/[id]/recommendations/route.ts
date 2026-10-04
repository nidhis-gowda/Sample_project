import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { getRecommendations } from "@/services/matchingService";
import { recommendationQuerySchema } from "@/lib/validators/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/:id/recommendations
 * Runs the matching engine and returns a ranked, fully explained shortlist.
 */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "matching:recommend", ...READ_LIMIT });
  // `matching:read`, not `project:read`: ranking and scoring the whole company
  // is a management capability, not something every viewer of a project may do.
  await requirePermission("matching:read");

  const { id } = await context.params;
  const filters = readQuery(request, recommendationQuerySchema);
  const result = await getRecommendations(id, filters);

  return ok(result, {
    meta: {
      engine: result.engine,
      fallbackReason: result.fallbackReason ?? null,
      candidatesEvaluated: result.candidatesEvaluated,
      returned: result.results.length,
    },
  });
});