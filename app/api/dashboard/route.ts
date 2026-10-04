import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { buildDashboard } from "@/services/dashboardService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard — live company (or personal) analytics payload. */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "dashboard:read", ...READ_LIMIT });
  const user = await requirePermission("dashboard:read");
  return ok(await buildDashboard(user));
});