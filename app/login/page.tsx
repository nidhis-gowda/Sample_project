import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth/rbac";
import { ROLE_CAPABILITIES } from "@/lib/auth/permissions";
import { USER_ROLE_LABELS, USER_ROLES } from "@/types";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  const params = await searchParams;
  if (user) redirect(params.callbackUrl ?? "/dashboard");

  const callbackUrl = params.callbackUrl ?? "/dashboard";
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillAlloc";
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const demoEnabled = process.env.ENABLE_DEV_CREDENTIALS === "true";

  const errorMessage =
    params.error === "OAuthAccountNotLinked"
      ? "That Google account is already linked to a different user record. Sign in with the original account."
      : params.error
        ? "Sign-in was cancelled or failed. Please try again."
        : null;

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 lg:flex-row">
      {/* Form side */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              SA
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">
              {appName}
            </span>
          </Link>

          {errorMessage ? (
            <div className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
              {errorMessage}
            </div>
          ) : null}

          <LoginForm
            googleEnabled={googleEnabled}
            demoEnabled={demoEnabled}
            callbackUrl={callbackUrl}
          />

          <p className="mt-6 text-center text-xs text-ink-500">
            By signing in you agree that your name, email and profile picture are stored so
            the platform can show your profile and allocations. No password is stored.
          </p>
        </div>
      </div>

      {/* Marketing side */}
      <div className="hidden flex-1 items-center justify-center bg-ink-900 px-10 py-12 lg:flex">
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            One place for skills, projects and capacity
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            Your Google account only identifies you. Everything the platform shows —
            projects you are allocated to, your workload, your training plan — is read from
            the company database and filtered by your role.
          </p>

          <div className="mt-8 space-y-5">
            {USER_ROLES.map((role) => (
              <div key={role}>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                  {USER_ROLE_LABELS[role]}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {ROLE_CAPABILITIES[role].map((capability) => (
                    <li key={capability} className="flex gap-2 text-sm text-ink-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}