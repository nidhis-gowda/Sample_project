import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { deleteTraining, updateTraining } from "@/services/trainingService";
import { updateTrainingSchema } from "@/lib/validators/skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/training/:id */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "training:write", ...WRITE_LIMIT });
  await requirePermission("training:manage");
  const { id } = await context.params;
  const body = await readBody(request, updateTrainingSchema);
  return ok(await updateTraining(id, body));
});

/** DELETE /api/training/:id */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "training:write", ...WRITE_LIMIT });
  await requirePermission("training:manage");
  const { id } = await context.params;
  await deleteTraining(id);
  return noContent();
});