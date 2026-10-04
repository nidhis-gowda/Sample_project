import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { removeRequirement, upsertRequirement } from "@/services/projectService";
import { projectRequirementBodySchema } from "@/lib/validators/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/requirements — add or update one required skill.
 * Removing a requirement is handled by the nested `[skillId]/route.ts` DELETE.
 */
export const POST = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "projects:requirements", ...WRITE_LIMIT });
  await requirePermission("project:update");
  const { id } = await context.params;
  const body = await readBody(request, projectRequirementBodySchema);
  return ok(await upsertRequirement(id, body));
});