import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Edge middleware.
 *
 * This is a *coarse* gate: it redirects unauthenticated visitors away from the
 * protected page routes. It intentionally does NOT perform role checks — those
 * are always enforced again server-side (server components, layouts and API
 * route handlers) so security never depends on the middleware.
 *
 * `auth.config.ts` is edge-safe (no Mongoose import), which is required here.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Run on everything except static assets and the Auth.js endpoints.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};