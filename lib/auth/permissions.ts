import type { UserRole } from "@/types";

/**
 * Central permission catalogue.
 *
 * IMPORTANT: this module is isomorphic (safe to import from client components)
 * because it contains no server-only dependencies. Server-side enforcement lives
 * in `lib/auth/rbac.ts`.
 */

export const PERMISSIONS = [
  "dashboard:read",
  "employee:read",
  "employee:create",
  "employee:update",
  "employee:delete",
  "skill:read",
  "skill:manage",
  "department:manage",
  "project:read",
  "project:create",
  "project:update",
  "project:delete",
  "allocation:read",
  "allocation:manage",
  /**
   * Running the matching engine and ranking staff. Deliberately separate from
   * `project:read`: an EMPLOYEE may read projects they are involved in, but
   * must not be able to score and rank every person in the company.
   */
  "matching:read",
  "workload:read",
  "skillgap:read",
  "training:read",
  "report:read",
  "notification:read",
  "user:manage",
  "settings:manage",
  "profile:update:own",
  "training:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const PROJECT_MANAGER: Permission[] = [
  "dashboard:read",
  "employee:read",
  "employee:update",
  "skill:read",
  "skill:manage",
  "project:read",
  "project:create",
  "project:update",
  "allocation:read",
  "allocation:manage",
  "matching:read",
  "workload:read",
  "skillgap:read",
  "training:read",
  "training:manage",
  "report:read",
  "notification:read",
  "profile:update:own",
];

const EMPLOYEE: Permission[] = [
  "dashboard:read",
  "employee:read",
  "skill:read",
  "project:read",
  "training:read",
  "workload:read",
  "skillgap:read",
  "notification:read",
  "profile:update:own",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ALL,
  PROJECT_MANAGER,
  EMPLOYEE,
};

export function can(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(
  role: UserRole | undefined | null,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => can(role, permission));
}

/** Human readable description of each role, used on the login/help screens. */
export const ROLE_CAPABILITIES: Record<UserRole, string[]> = {
  ADMIN: [
    "Manage users, roles and system settings",
    "Manage employees, skills and departments",
    "View every project, allocation and company analytics",
  ],
  PROJECT_MANAGER: [
    "Create projects and define required skills",
    "Run the matching engine and build teams",
    "Allocate employees and monitor workload",
  ],
  EMPLOYEE: [
    "Maintain your own profile and skills",
    "Set your availability",
    "View assigned projects, workload and training",
  ],
};