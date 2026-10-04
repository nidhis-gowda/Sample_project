import { z } from "zod";
import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/rbac";
import { searchEmployees, searchProjects, searchSkills } from "@/services/searchService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1, "Enter a search term").max(120),
  limit: z.coerce.number().int().min(1).max(25).default(6),
});

/** GET /api/search — global search across employees, skills, projects, departments. */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "search", ...READ_LIMIT });
  const user = await requireUser();
  const { q, limit } = readQuery(request, querySchema);

  const [employees, skills, projects, departments] = await Promise.all([
    searchEmployees(q, limit, user.role === "EMPLOYEE"),
    searchSkills(q, limit),
    searchProjects(q, limit),
    searchDepartments(q, limit),
  ]);

  return ok({ employees, skills, projects, departments, query: q });
});

async function searchDepartments(q: string, limit: number) {
  const { listDepartments } = await import("@/services/departmentService");
  const rows = await listDepartments({ q });
  return rows.slice(0, limit).map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    employeeCount: department.employeeCount,
  }));
}