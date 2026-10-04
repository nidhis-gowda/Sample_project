import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { getSettings, updateSettings } from "@/services/settingsService";
import { updateSettingsSchema } from "@/lib/validators/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/settings */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "admin:settings", ...READ_LIMIT });
  await requirePermission("settings:manage");
  return ok(await getSettings());
});

/** PUT /api/admin/settings */
export const PUT = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "admin:settings", ...WRITE_LIMIT });
  await requirePermission("settings:manage");
  const body = await readBody(request, updateSettingsSchema);
  return ok(await updateSettings(body));
});