import { readBody, readQuery } from "@/lib/api/body";
import { created, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { createDepartment, listDepartments } from "@/services/departmentService";
import { createDepartmentSchema } from "@/lib/validators/skill";
import { listQuerySchema } from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/departments */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "departments:list", ...READ_LIMIT });
  await requirePermission("employee:read");
  const query = readQuery(request, listQuerySchema);
  return ok(
    await listDepartments({ q: query.q, sort: query.sort, direction: query.direction })
  );
});

/** POST /api/departments */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "departments:write", ...WRITE_LIMIT });
  await requirePermission("department:manage");
  const body = await readBody(request, createDepartmentSchema);
  return created(await createDepartment(body));
});