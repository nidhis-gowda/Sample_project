import { describe, expect, it } from "vitest";
import { can, canAny, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { HttpError } from "@/lib/api/http-error";
import { canEditEmployee, isOwnProfile, scopeToSelf } from "@/lib/auth/access";
import type { SessionUser } from "@/lib/auth/rbac";
import { USER_ROLE_LABELS, type UserRole } from "@/types";

/**
 * Authorization tests.
 *
 * These assert the permission matrix that every API route handler relies on.
 * They are the contract for role-based access control; the middleware and the
 * server components re-check the same permissions at request time.
 */

function user(role: UserRole, employeeId: string | null = null): SessionUser {
  return {
    id: `user-${role}`,
    name: `Test ${USER_ROLE_LABELS[role]}`,
    email: `${role.toLowerCase()}@example.com`,
    image: null,
    role,
    employeeId,
  };
}

describe("permission catalogue", () => {
  it("grants every permission to an ADMIN", () => {
    for (const permission of PERMISSIONS) {
      expect(can("ADMIN", permission)).toBe(true);
    }
  });

  it("denies destructive and administrative permissions to an EMPLOYEE", () => {
    const forbidden: Permission[] = [
      "employee:create",
      "employee:update",
      "employee:delete",
      "skill:manage",
      "department:manage",
      "project:create",
      "project:update",
      "project:delete",
      "allocation:manage",
      "matching:read",
      "user:manage",
      "settings:manage",
      "training:manage",
    ];
    for (const permission of forbidden) {
      expect(can("EMPLOYEE", permission)).toBe(false);
    }
  });

  it("keeps the matching engine out of reach of an EMPLOYEE", () => {
    // An EMPLOYEE may read projects, but must not be able to rank and score the
    // whole company through /recommendations or the Team Builder.
    expect(can("EMPLOYEE", "matching:read")).toBe(false);
    expect(can("PROJECT_MANAGER", "matching:read")).toBe(true);
    expect(can("ADMIN", "matching:read")).toBe(true);
  });

  it("lets an EMPLOYEE read the screens they need", () => {
    const allowed: Permission[] = [
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
    for (const permission of allowed) {
      expect(can("EMPLOYEE", permission)).toBe(true);
    }
  });

  it("lets a PROJECT_MANAGER manage projects and allocations but not users", () => {
    expect(can("PROJECT_MANAGER", "project:create")).toBe(true);
    expect(can("PROJECT_MANAGER", "project:update")).toBe(true);
    expect(can("PROJECT_MANAGER", "allocation:manage")).toBe(true);
    expect(can("PROJECT_MANAGER", "employee:update")).toBe(true);

    expect(can("PROJECT_MANAGER", "user:manage")).toBe(false);
    expect(can("PROJECT_MANAGER", "settings:manage")).toBe(false);
    expect(can("PROJECT_MANAGER", "employee:create")).toBe(false);
    expect(can("PROJECT_MANAGER", "project:delete")).toBe(false);
  });

  it("never returns true for an unknown role", () => {
    expect(can(undefined, "dashboard:read")).toBe(false);
    expect(can(null, "dashboard:read")).toBe(false);
    expect(can("SUPERUSER" as UserRole, "dashboard:read")).toBe(false);
  });

  it("supports canAny for multi-permission checks", () => {
    expect(canAny("EMPLOYEE", ["user:manage", "dashboard:read"])).toBe(true);
    expect(canAny("EMPLOYEE", ["user:manage", "settings:manage"])).toBe(false);
  });

  it("keeps every permission list free of duplicates", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as UserRole[]) {
      const list = ROLE_PERMISSIONS[role];
      expect(new Set(list).size).toBe(list.length);
    }
  });
});

describe("object-level access (canEditEmployee)", () => {
  it("lets an ADMIN and a PROJECT_MANAGER edit anyone", () => {
    expect(canEditEmployee(user("ADMIN"), "emp-1")).toBe(true);
    expect(canEditEmployee(user("PROJECT_MANAGER"), "emp-1")).toBe(true);
  });

  it("lets an EMPLOYEE edit only their own profile", () => {
    expect(canEditEmployee(user("EMPLOYEE", "emp-1"), "emp-1")).toBe(true);
    expect(canEditEmployee(user("EMPLOYEE", "emp-1"), "emp-2")).toBe(false);
  });

  it("denies an EMPLOYEE with no linked employee record", () => {
    expect(canEditEmployee(user("EMPLOYEE", null), "emp-1")).toBe(false);
  });

  it("throws a helpful 403 when the edit is not allowed", () => {
    try {
      const employeeUser = user("EMPLOYEE", "emp-1");
      if (canEditEmployee(employeeUser, "emp-2")) throw new Error("should not be allowed");
      throw HttpError.forbidden("You can only edit your own employee profile.");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const httpError = error as HttpError;
      expect(httpError.status).toBe(403);
      expect(httpError.code).toBe("FORBIDDEN");
    }
  });
});

describe("row-level scoping (scopeToSelf, isOwnProfile)", () => {
  it("forces an EMPLOYEE onto their own employee id", () => {
    expect(scopeToSelf(user("EMPLOYEE", "emp-9"), "emp-1")).toBe("emp-9");
  });

  it("lets a manager request any employee", () => {
    expect(scopeToSelf(user("PROJECT_MANAGER", "emp-9"), "emp-1")).toBe("emp-1");
    expect(scopeToSelf(user("ADMIN"), "emp-1")).toBe("emp-1");
  });

  it("identifies ownership", () => {
    expect(isOwnProfile(user("EMPLOYEE", "emp-1"), "emp-1")).toBe(true);
    expect(isOwnProfile(user("EMPLOYEE", "emp-1"), "emp-2")).toBe(false);
    expect(isOwnProfile(user("EMPLOYEE", null), "emp-1")).toBe(false);
  });
});

describe("HttpError", () => {
  it("maps statuses onto codes", () => {
    expect(HttpError.badRequest().code).toBe("BAD_REQUEST");
    expect(HttpError.unauthorized().status).toBe(401);
    expect(HttpError.forbidden().status).toBe(403);
    expect(HttpError.notFound().status).toBe(404);
    expect(HttpError.conflict().status).toBe(409);
    expect(HttpError.tooManyRequests().status).toBe(429);
    expect(HttpError.internal().status).toBe(500);
  });

  it("carries field level validation messages", () => {
    const error = HttpError.badRequest("Invalid", { email: "Enter a valid email" });
    expect(error.fields).toEqual({ email: "Enter a valid email" });
  });
});