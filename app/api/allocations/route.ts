import { z } from "zod";
import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { listAllocations } from "@/services/allocationService";
import { allocationStatusSchema } from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = z.object({
  projectId: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  status: allocationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

/** GET /api/allocations */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "allocations:read", ...READ_LIMIT });
  await requirePermission("allocation:read");
  const query = readQuery(request, listSchema);
  return ok(
    await listAllocations({
      projectId: query.projectId,
      employeeId: query.employeeId,
      status: query.status,
      limit: query.limit,
    })
  );
});