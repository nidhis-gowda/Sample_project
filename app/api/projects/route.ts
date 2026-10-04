import { z } from "zod";
import { readBody, readQuery } from "@/lib/api/body";
import { created, ok, paginationMeta, readPagination, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission, requireUser } from "@/lib/auth/rbac";
import { createProject, listProjects } from "@/services/projectService";
import { createProjectSchema } from "@/lib/validators/project";
import {
  listQuerySchema,
  projectPrioritySchema,
  projectStatusSchema,
} from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = listQuerySchema.extend({
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional(),
  managerId: z.string().trim().optional(),
  skillId: z.string().trim().optional(),
  mine: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

/** GET /api/projects — `mine=true` restricts the list to managed projects. */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "projects:list", ...READ_LIMIT });
  await requirePermission("project:read");

  const { page, pageSize, skip } = readPagination(new URL(request.url).searchParams);
  const query = readQuery(request, listSchema);

  // A PROJECT_MANAGER without `mine=true` still only sees what they manage,
  // unless they explicitly widen the view by asking for everything.
  const user = await requireUser();
  const managerId =
    query.managerId ??
    (query.mine || user.role !== "PROJECT_MANAGER" ? undefined : user.id);

  const { items, total } = await listProjects({
    q: query.q,
    status: query.status,
    priority: query.priority,
    managerId,
    skillId: query.skillId,
    sort: query.sort,
    direction: query.direction,
    skip,
    pageSize,
  });

  return ok(items, { meta: paginationMeta(total, page, pageSize) });
});

/** POST /api/projects */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "projects:write", ...WRITE_LIMIT });
  const user = await requirePermission("project:create");
  const body = await readBody(request, createProjectSchema);
  return created(await createProject(body, user.id));
});