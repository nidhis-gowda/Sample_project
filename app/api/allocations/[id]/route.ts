import { readBody } from "@/lib/api/body";
import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { deleteAllocation, updateAllocation } from "@/services/allocationService";
import { updateAllocationSchema } from "@/lib/validators/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/allocations/:id */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "allocations:write", ...WRITE_LIMIT });
  const user = await requirePermission("allocation:manage");
  const { id } = await context.params;
  const body = await readBody(request, updateAllocationSchema);
  return ok(await updateAllocation(id, body, user.id));
});

/** DELETE /api/allocations/:id — releases the employee and refreshes workload. */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "allocations:write", ...WRITE_LIMIT });
  await requirePermission("allocation:manage");
  const { id } = await context.params;
  await deleteAllocation(id);
  return noContent();
});