import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/rbac";
import { assertCanEditEmployee } from "@/lib/auth/access";
import { setEmployeeSkills, upsertEmployeeSkill } from "@/services/employeeService";
import {
  setEmployeeSkillsSchema,
  upsertEmployeeSkillSchema,
} from "@/lib/validators/employee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/employees/:id/skills — replaces the whole skill set. */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:skills", ...WRITE_LIMIT });
  const user = await requireUser();
  const { id } = await context.params;
  assertCanEditEmployee(user, id);

  const body = await readBody(request, setEmployeeSkillsSchema);
  return ok(await setEmployeeSkills(id, body.skills));
});

/** POST /api/employees/:id/skills — adds or updates a single skill. */
export const POST = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:skills", ...WRITE_LIMIT });
  const user = await requireUser();
  const { id } = await context.params;
  assertCanEditEmployee(user, id);

  const body = await readBody(request, upsertEmployeeSkillSchema);
  return ok(await upsertEmployeeSkill(id, body));
});