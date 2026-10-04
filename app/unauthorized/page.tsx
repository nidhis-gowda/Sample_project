import Link from "next/link";
import { getSessionUser } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * Shown when a signed-in user lacks the permission for a page, and when
 * Auth.js redirects here after a failed sign-in.
 */
export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
            <path
              d="M12 9v4m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink-900">
          {error ? "Sign-in problem" : "You do not have access to this page"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {error
            ? "We could not complete the sign-in. Please try again, or use a different Google account."
            : "Your role does not include the permission required for this page. This is enforced on the server, so hiding the link would not have helped."}
        </p>

        {user ? (
          <p className="mt-3 text-sm text-ink-500">
            You are signed in as <span className="font-medium text-ink-800">{user.email}</span>.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Back to the dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn-primary">
              Sign in
            </Link>
          )}
          <Link href="/" className="btn-secondary">
            Go to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}