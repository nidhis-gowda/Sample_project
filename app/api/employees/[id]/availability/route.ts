import { readBody } from "@/lib/api/body";
import { ok, withApi } from "@/lib/api/response";
import { enforceRateLimit, WRITE_LIMIT } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/auth/rbac";
import { assertCanEditEmployee } from "@/lib/auth/access";
import { setAvailability } from "@/services/employeeService";
import { availabilitySchema } from "@/lib/validators/employee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** PUT /api/employees/:id/availability — employees may update their own. */
export const PUT = withApi(async (request: Request, context: Context) => {
  enforceRateLimit(request, { scope: "employees:availability", ...WRITE_LIMIT });
  const user = await requireUser();
  const { id } = await context.params;
  assertCanEditEmployee(user, id);

  const body = await readBody(request, availabilitySchema);
  return ok(await setAvailability(id, body.availabilityPercent));
});