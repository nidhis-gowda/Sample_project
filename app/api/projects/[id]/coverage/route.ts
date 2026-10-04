import { z } from "zod";
import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { getCoverageForEmployees } from "@/services/matchingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  employeeIds: z.array(z.string().trim().min(1)).min(1, "Select at least one employee").max(50),
});

/**
 * POST /api/projects/:id/coverage
 * Live Team Builder: recompute skill coverage for a candidate set as the manager
 * ticks employees, before anything is allocated.
 */
export const POST = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "matching:coverage", ...READ_LIMIT });
  // Same gate as /recommendations: the Team Builder is part of the matching
  // engine and exposes the same company-wide scoring information.
  await requirePermission("matching:read");

  const { id } = await context.params;
  const body = await readBody(request, bodySchema);
  return ok(await getCoverageForEmployees(id, body.employeeIds));
});