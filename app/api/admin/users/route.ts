import { z } from "zod";
import { readBody, readQuery } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, READ_LIMIT, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requirePermission } from "@/lib/auth/rbac";
import { HttpError } from "@/lib/api/http-error";
import { listUsersForAdmin, updateUserAccount } from "@/services/analyticsService";
import { updateUserSchema } from "@/lib/validators/admin";
import { listQuerySchema } from "@/lib/validators/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  userId: z.string().trim().min(1, "A user id is required"),
});

/** GET /api/admin/users */
export const GET = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "admin:users", ...READ_LIMIT });
  await requirePermission("user:manage");
  const query = readQuery(request, listQuerySchema);
  const users = await listUsersForAdmin();

  const term = query.q?.toLowerCase();
  const filtered = term
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term) ||
          user.role.toLowerCase().includes(term)
      )
    : users;

  return ok(filtered, {
    meta: {
      total: users.length,
      admins: users.filter((user) => user.role === "ADMIN").length,
      managers: users.filter((user) => user.role === "PROJECT_MANAGER").length,
      employees: users.filter((user) => user.role === "EMPLOYEE").length,
    },
  });
});

/** PATCH /api/admin/users — change role, active flag or display name. */
export const PATCH = withApi(async (request: Request) => {
  enforceRateLimit(request, { scope: "admin:users", ...WRITE_LIMIT });
  const actor = await requirePermission("user:manage");

  const { userId } = await readBody(request, patchSchema);
  const updates = await readBody(request, updateUserSchema);

  if (Object.keys(updates).length === 0) {
    throw HttpError.badRequest("Provide at least one field to update.");
  }

  // An admin cannot demote or deactivate their own account — that is how an
  // installation accidentally ends up with no administrator.
  if (userId === actor.id && (updates.role !== undefined || updates.isActive === false)) {
    throw HttpError.badRequest(
      "You cannot change your own role or deactivate your own account."
    );
  }

  return ok(await updateUserAccount(userId, updates));
});