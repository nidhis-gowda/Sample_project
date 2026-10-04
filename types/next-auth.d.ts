import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

/**
 * Auth.js (NextAuth v5) module augmentation.
 * Adds our application specific fields to the session, user and JWT types.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      employeeId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    employeeId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: UserRole;
    employeeId?: string | null;
    roleSyncedAt?: number;
  }
}