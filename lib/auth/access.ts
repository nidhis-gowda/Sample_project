import { HttpError } from "@/lib/api/http-error";
import { can } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/rbac";

/**
 * Object-level authorization helpers.
 *
 * Role permissions (`can(role, "employee:update")`) answer "may this role do
 * this *kind* of thing?". These helpers answer "may this user do it to *this*
 * record?" — which is what actually protects one employee from editing another.
 */

/** True when the user owns the employee profile linked to their account. */
export function isOwnProfile(user: SessionUser, employeeUserId?: string | null): boolean {
  if (!user.employeeId) return false;
  if (!employeeUserId) return user.employeeId === employeeUserId;
  return user.employeeId === employeeUserId;
}

/**
 * Employees may only edit their own profile (and only through the restricted
 * self-service schema). Managers/admins may edit anyone they can update.
 */
export function canEditEmployee(user: SessionUser, targetEmployeeId: string): boolean {
  if (can(user.role, "employee:update")) return true;
  return user.employeeId === targetEmployeeId;
}

/**
 * Requires employee:update OR ownership. Throws 403 with a precise reason so the
 * UI can show a useful message instead of a generic denial.
 */
export function assertCanEditEmployee(user: SessionUser, targetEmployeeId: string): void {
  if (canEditEmployee(user, targetEmployeeId)) return;
  throw HttpError.forbidden(
    can(user.role, "employee:update")
      ? "You can only edit your own employee profile."
      : "You do not have permission to edit employee records."
  );
}

/** Training and workload rows are restricted: an employee only sees their own. */
export function scopeToSelf(user: SessionUser, requestedId?: string): string | undefined {
  if (user.role === "EMPLOYEE") return user.employeeId ?? undefined;
  return requestedId;
}