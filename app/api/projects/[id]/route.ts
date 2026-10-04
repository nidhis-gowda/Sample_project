import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import {
  deleteProject,
  getProjectById,
  updateProject,
} from "@/services/projectService";
import { getProjectTeamSummary } from "@/services/allocationService";
import { getCurrentTeamCoverage } from "@/services/matchingService";
import { updateProjectSchema } from "@/lib/validators/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/projects/:id — project, active team and live skill coverage. */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "projects:read", ...READ_LIMIT });
  await requirePermission("project:read");
  const { id } = await context.params;

  const [project, team, coverage] = await Promise.all([
    getProjectById(id),
    getProjectTeamSummary(id),
    getCurrentTeamCoverage(id),
  ]);

  return ok({
    ...project,
    team: team.allocations,
    coverage: coverage.coverage,
    memberIds: coverage.memberIds,
  });
});

/** PUT /api/projects/:id */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "projects:write", ...WRITE_LIMIT });
  await requirePermission("project:update");
  const { id } = await context.params;
  const body = await readBody(request, updateProjectSchema);
  return ok(await updateProject(id, body));
});

/** DELETE /api/projects/:id — blocked while active allocations exist. */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "projects:write", ...WRITE_LIMIT });
  await requirePermission("project:delete");
  const { id } = await context.params;
  await deleteProject(id);
  return noContent();
});