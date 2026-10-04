import { z } from "zod";
import { readBody, readQuery } from "@/lib/api/body";
import { created, ok, paginationMeta, readPagination, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { createSkill, listSkills } from "@/services/skillService";
import { createSkillSchema } from "@/lib/validators/skill";
import { listQuerySchema, skillCategorySchema } from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = listQuerySchema.extend({
  category: skillCategorySchema.optional(),
});

/** GET /api/skills */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "skills:list", ...READ_LIMIT });
  await requirePermission("skill:read");

  const { page, pageSize, skip } = readPagination(new URL(request.url).searchParams);
  const query = readQuery(request, listSchema);

  const { items, total } = await listSkills({
    q: query.q,
    category: query.category,
    sort: query.sort,
    direction: query.direction,
    skip,
    pageSize,
  });

  return ok(items, { meta: paginationMeta(total, page, pageSize) });
});

/** POST /api/skills */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "skills:write", ...WRITE_LIMIT });
  await requirePermission("skill:manage");
  const body = await readBody(request, createSkillSchema);
  return created(await createSkill(body));
});