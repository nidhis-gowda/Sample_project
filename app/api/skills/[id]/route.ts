import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { deleteSkill, getSkillById, updateSkill } from "@/services/skillService";
import { updateSkillSchema } from "@/lib/validators/skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/skills/:id */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "skills:read", ...READ_LIMIT });
  await requirePermission("skill:read");
  const { id } = await context.params;
  return ok(await getSkillById(id));
});

/** PUT /api/skills/:id */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "skills:write", ...WRITE_LIMIT });
  await requirePermission("skill:manage");
  const { id } = await context.params;
  const body = await readBody(request, updateSkillSchema);
  return ok(await updateSkill(id, body));
});

/** DELETE /api/skills/:id — rejected with 409 while the skill is referenced. */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "skills:write", ...WRITE_LIMIT });
  await requirePermission("skill:manage");
  const { id } = await context.params;
  await deleteSkill(id);
  return noContent();
});