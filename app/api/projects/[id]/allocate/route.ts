import { readJsonObject } from "@/lib/api/body";
import { created, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { HttpError } from "@/lib/api/http-error";
import {
  allocateTeam,
  createAllocation,
  getProjectTeamSummary,
} from "@/services/allocationService";
import { allocateTeamSchema, createAllocationSchema } from "@/lib/validators/project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/allocate
 * `allocationPercent` allocates one person; `members` allocates a whole team.
 * Both block over-allocation with a 409 unless `allowOverallocated` is set.
 */
export const POST = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "allocations:write", ...WRITE_LIMIT });
  const user = await requirePermission("allocation:manage");
  const { id } = await context.params;

  // The payload shape decides whether this is a single allocation or a whole
  // team. It must be read exactly once: a Request body stream is single-use, so
  // sniffing with `request.json()` and then handing the Request to `readBody`
  // would fail with "The request body must be valid JSON."
  const raw = await readJsonObject(request);
  const isTeam = Array.isArray(raw.members);

  if (isTeam) {
    const body = allocateTeamSchema.parse(raw);
    const result = await allocateTeam(id, body, user.id);
    return created(result);
  }

  const body = createAllocationSchema.parse(raw);
  return created(await createAllocation(id, body, user.id));
});

/** GET /api/projects/:id/allocate — current team summary. */
export const GET = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "allocations:read", ...READ_LIMIT });
  await requirePermission("allocation:read");
  const { id } = await context.params;
  if (!id) throw HttpError.badRequest("A project is required.");
  return ok(await getProjectTeamSummary(id));
});