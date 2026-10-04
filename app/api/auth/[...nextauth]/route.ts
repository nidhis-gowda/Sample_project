import { handlers } from "@/auth";

/**
 * Auth.js catch-all route handler.
 * Handles /api/auth/signin, /api/auth/callback/google, /api/auth/session, ...
 */
export const { GET, POST } = handlers;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";