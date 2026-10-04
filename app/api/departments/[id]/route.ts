import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import {
  deleteDepartment,
  getDepartmentById,
  updateDepartment,
} from "@/services/departmentService";
import { updateDepartmentSchema } from "@/lib/validators/skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/departments/:id */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "departments:read", ...READ_LIMIT });
  await requirePermission("employee:read");
  const { id } = await context.params;
  return ok(await getDepartmentById(id));
});

/** PUT /api/departments/:id */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "departments:write", ...WRITE_LIMIT });
  await requirePermission("department:manage");
  const { id } = await context.params;
  const body = await readBody(request, updateDepartmentSchema);
  return ok(await updateDepartment(id, body));
});

/** DELETE /api/departments/:id — blocked while employees are still assigned. */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "departments:write", ...WRITE_LIMIT });
  await requirePermission("department:manage");
  const { id } = await context.params;
  await deleteDepartment(id);
  return noContent();
});