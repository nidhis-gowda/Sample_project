import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { removeRequirement } from "@/services/projectService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; skillId: string }> };

/**
 * DELETE /api/projects/:id/requirements/:skillId
 *
 * Removes a single required skill from a project. Removing a requirement changes
 * the matching score for every candidate, so it is protected by the same
 * `project:update` permission as editing the project itself.
 */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "projects:requirements", ...WRITE_LIMIT });
  await requirePermission("project:update");

  const { id, skillId } = await context.params;
  return ok(await removeRequirement(id, skillId));
});