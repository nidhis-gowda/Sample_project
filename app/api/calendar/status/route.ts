import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { getCalendarStatus } from "@/services/calendarService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/calendar/status — is the optional integration available/connected? */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "calendar:status", ...READ_LIMIT });
  const user = await requirePermission("profile:update:own");
  return ok(await getCalendarStatus(user.id, user.employeeId));
});