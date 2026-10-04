import { z } from "zod";
import { readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { listNotifications, unreadCount } from "@/services/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

/**
 * GET /api/notifications
 * Scoped to the signed-in user — a notification can never be read by anyone else.
 */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "notifications:read", ...READ_LIMIT });
  const user = await requirePermission("notification:read");
  const query = readQuery(request, querySchema);

  const [items, unread] = await Promise.all([
    listNotifications(user.id, { limit: query.limit, unreadOnly: query.unreadOnly }),
    unreadCount(user.id),
  ]);

  return ok(items, { meta: { unread } });
});