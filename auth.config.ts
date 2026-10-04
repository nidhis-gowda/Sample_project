import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@/types";

/**
 * Edge-safe Auth.js configuration.
 *
 * IMPORTANT: this module must never import Mongoose (or any Node-only module)
 * because it is also loaded by `middleware.ts`, which runs on the Edge runtime.
 * All database access lives in `auth.ts`.
 */

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/** Route prefixes that require an authenticated session. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/employees",
  "/skills",
  "/projects",
  "/allocation",
  "/workload",
  "/skill-gaps",
  "/training",
  "/reports",
  "/profile",
  "/departments",
  "/notifications",
  "/admin",
  "/api/employees",
  "/api/projects",
  "/api/skills",
  "/api/departments",
  "/api/allocations",
  "/api/workload",
  "/api/skill-gaps",
  "/api/dashboard",
  "/api/reports",
  "/api/notifications",
  "/api/training",
  "/api/search",
  "/api/admin",
  "/api/calendar",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const ID_DEMO_PROVIDER = "demo";

/**
 * Auth.js requires at least one provider to be configured. When Google OAuth is
 * not configured yet, a deny-all placeholder provider keeps the app bootable
 * (and the middleware working) while the real, database-backed "demo" provider
 * is attached in `auth.ts`.
 */
const providerList: NextAuthConfig["providers"] = googleConfigured
  ? [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
            // calendar.readonly enables the optional availability integration.
            scope:
              "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          },
        },
      }),
    ]
  : [];

// Placeholder (always denies). Replaced with the real implementation in auth.ts
// because the edge runtime cannot import Mongoose.
providerList.push(
  Credentials({
    id: ID_DEMO_PROVIDER,
    name: "Demo account",
    credentials: { email: { label: "Email", type: "email" } },
    authorize: () => null,
  })
);

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: "/login",
    error: "/unauthorized",
  },
  providers: providerList,
  callbacks: {
    /** Used by middleware only — coarse authentication gate for page routes. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (!isProtectedPath(pathname)) return true;
      return Boolean(auth?.user);
    },

    /**
     * Base token mapping (no DB access). `auth.ts` extends this with a database
     * synchronisation step.
     */
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user.role as UserRole) ?? "EMPLOYEE";
        token.employeeId = user.employeeId ?? null;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.uid ?? token.sub ?? "");
        session.user.role = (token.role as UserRole) ?? "EMPLOYEE";
        session.user.employeeId = token.employeeId ? String(token.employeeId) : null;
      }
      return session;
    },
  },
};

export default authConfig;