import { z } from "zod";
import { readBody, readQuery } from "@/lib/api/body";
import { created, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { createTraining, listTraining } from "@/services/trainingService";
import { createTrainingSchema } from "@/lib/validators/skill";
import { listQuerySchema, trainingLevelSchema } from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = listQuerySchema.extend({
  level: trainingLevelSchema.optional(),
  skillName: z.string().trim().max(80).optional(),
});

/** GET /api/training */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "training:read", ...READ_LIMIT });
  await requirePermission("training:read");
  const query = readQuery(request, listSchema);

  return ok(
    await listTraining({
      q: query.q,
      level: query.level,
      skillName: query.skillName,
      sort: query.sort,
      direction: query.direction,
    })
  );
});

/** POST /api/training */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "training:write", ...WRITE_LIMIT });
  await requirePermission("training:manage");
  const body = await readBody(request, createTrainingSchema);
  return created(await createTraining(body));
});