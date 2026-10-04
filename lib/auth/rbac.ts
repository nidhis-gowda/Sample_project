import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HttpError } from "@/lib/api/http-error";
import { can, type Permission } from "@/lib/auth/permissions";
import type { UserRole } from "@/types";

/**
 * SERVER-ONLY authorization helpers.
 *
 * Every API route handler and every protected server component must call these
 * — hiding a button in the UI is never treated as authorization.
 */

export interface SessionUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  employeeId: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "EMPLOYEE",
    employeeId: session.user.employeeId ?? null,
  };
}

/** Throws 401 when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw HttpError.unauthorized();
  return user;
}

/** Throws 403 when the current role lacks the permission. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw HttpError.forbidden(
      `Your role (${user.role.replace("_", " ").toLowerCase()}) is not allowed to perform this action.`
    );
  }
  return user;
}

/** Throws 403 unless the current role is in the allow list. */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw HttpError.forbidden(
      `This action requires one of the following roles: ${roles.join(", ")}.`
    );
  }
  return user;
}

/**
 * Page-level guard: redirects instead of throwing so users get a friendly
 * experience (login page when signed out, /unauthorized when lacking rights).
 */
export async function requirePageUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) redirect("/unauthorized");
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN";
}

export function isProjectManagerOrAdmin(user: SessionUser | null): boolean {
  return user?.role === "ADMIN" || user?.role === "PROJECT_MANAGER";
}