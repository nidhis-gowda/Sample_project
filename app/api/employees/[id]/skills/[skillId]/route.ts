import { HttpError } from "@/lib/api/http-error";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/rbac";
import { assertCanEditEmployee } from "@/lib/auth/access";
import { removeEmployeeSkill } from "@/services/employeeService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; skillId: string }> };

/** DELETE /api/employees/:id/skills/:skillId */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:skills", ...WRITE_LIMIT });
  const user = await requireUser();
  const { id, skillId } = await context.params;
  assertCanEditEmployee(user, id);
  if (!skillId) throw HttpError.badRequest("A skill identifier is required.");
  return ok(await removeEmployeeSkill(id, skillId));
});