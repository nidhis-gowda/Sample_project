import { noContent, ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { deleteNotification, markReadSafe } from "@/services/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/notifications/:id — marks one notification as read (owner only). */
export const PATCH = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "notifications:write", ...WRITE_LIMIT });
  const user = await requirePermission("notification:read");
  const { id } = await context.params;
  return ok({ updated: await markReadSafe(user.id, id) });
});

/** DELETE /api/notifications/:id */
export const DELETE = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "notifications:write", ...WRITE_LIMIT });
  const user = await requirePermission("notification:read");
  const { id } = await context.params;
  await deleteNotification(user.id, id);
  return noContent();
});