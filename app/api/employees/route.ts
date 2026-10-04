import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/api/http-error";
import { readBody, readQuery } from "@/lib/api/body";
import { ok, paginationMeta, readPagination, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission, requireUser } from "@/lib/auth/rbac";
import { createEmployee, listEmployees } from "@/services/employeeService";
import { createEmployeeSchema } from "@/lib/validators/employee";
import {
  employeeStatusSchema,
  jobRoleSchema,
  listQuerySchema,
} from "@/lib/validators/common";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = listQuerySchema.extend({
  departmentId: z.string().trim().optional(),
  jobRole: jobRoleSchema.optional(),
  status: employeeStatusSchema.optional(),
  skillId: z.string().trim().optional(),
});

/** GET /api/employees — filtered, sorted, paginated employee directory. */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "employees:list", ...READ_LIMIT });
  await requirePermission("employee:read");

  const { page, pageSize, skip } = readPagination(new URL(request.url).searchParams);
  const query = readQuery(request, listSchema);

  const { items, total } = await listEmployees({
    q: query.q,
    departmentId: query.departmentId,
    jobRole: query.jobRole,
    status: query.status,
    skillId: query.skillId,
    sort: query.sort,
    direction: query.direction,
    skip,
    pageSize,
  });

  return ok(items, { meta: paginationMeta(total, page, pageSize) });
});

/** POST /api/employees — ADMIN only. */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "employees:write", ...WRITE_LIMIT });
  await requirePermission("employee:create");

  const body = await readBody(request, createEmployeeSchema);
  const employee = await createEmployee(body);
  return NextResponse.json({ ok: true as const, data: employee }, { status: 201 });
});