import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { disconnectCalendar, syncCalendarAvailability } from "@/services/calendarService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/calendar/sync — refresh the derived availability percentage. */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "calendar:sync", ...WRITE_LIMIT });
  const user = await requirePermission("profile:update:own");
  return ok(await syncCalendarAvailability(user.id));
});

/** DELETE /api/calendar/sync — opt out and revert to manual availability. */
export const DELETE = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "calendar:sync", ...WRITE_LIMIT });
  const user = await requirePermission("profile:update:own");
  return ok(await disconnectCalendar(user.id));
});