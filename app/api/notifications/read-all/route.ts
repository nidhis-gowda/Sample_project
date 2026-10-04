import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { markAllNotificationsRead } from "@/services/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/notifications/read-all */
export const POST = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "notifications:write", ...WRITE_LIMIT });
  const user = await requirePermission("notification:read");
  const updated = await markAllNotificationsRead(user.id);
  return ok({ updated });
});