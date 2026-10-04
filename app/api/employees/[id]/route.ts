import { HttpError } from "@/lib/api/http-error";
import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission, requireUser } from "@/lib/auth/rbac";
import { assertCanEditEmployee } from "@/lib/auth/access";
import {
  deleteEmployee,
  getEmployeeById,
  updateEmployee,
  updateOwnProfile,
} from "@/services/employeeService";
import { listAllocations } from "@/services/allocationService";
import { recommendTrainingForGaps } from "@/services/trainingService";
import {
  selfEmployeeUpdateSchema,
  updateEmployeeSchema,
} from "@/lib/validators/employee";
import { can } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/employees/:id — profile + active allocations + recommended training. */
export const GET = withApi(async (_request: Request, context: Context) => {
  enforceRateLimit(_request, { scope: "employees:read", ...READ_LIMIT });
  await requirePermission("employee:read");

  const { id } = await context.params;
  const employee = await getEmployeeById(id);
  const allocations = await listAllocations({ employeeId: id, status: "ACTIVE" });

  // Training recommendations describe personal development, so an EMPLOYEE only
  // ever sees their own. Managers and admins can inspect anyone (they need it to
  // decide who to send on a course).
  const user = await requireUser();
  const canSeeTraining = user.role !== "EMPLOYEE" || user.employeeId === id;

  let training: Awaited<ReturnType<typeof recommendTrainingForGaps>> = [];
  if (canSeeTraining) {
    const gaps = employee.skills
      .filter((skill) => skill.proficiency < 3)
      .map((skill) => ({
        skillId: skill.skillId,
        skillName: skill.skillName,
        currentProficiency: skill.proficiency,
        requiredProficiency: 3,
        reason: `Profile level ${skill.proficiency}/5 — level 3 is the company baseline.`,
      }));
    training = await recommendTrainingForGaps(gaps);
  }

  return ok({ ...employee, allocations, training });
});

/**
 * PUT /api/employees/:id
 * Managers/admins use the full schema; an EMPLOYEE editing their own profile is
 * restricted to the self-service schema (verified server-side, not in the UI).
 */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:write", ...WRITE_LIMIT });
  const user = await requireUser();
  const { id } = await context.params;
  assertCanEditEmployee(user, id);

  if (!can(user.role, "employee:update")) {
    const body = await readBody(request, selfEmployeeUpdateSchema);
    const employee = await updateOwnProfile(id, body);
    return ok(employee);
  }

  const body = await readBody(request, updateEmployeeSchema);
  return ok(await updateEmployee(id, body));
});

/** DELETE /api/employees/:id — ADMIN only, blocked while allocations exist. */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:write", ...WRITE_LIMIT });
  await requirePermission("employee:delete");
  const { id } = await context.params;
  await deleteEmployee(id);
  return noContent();
});