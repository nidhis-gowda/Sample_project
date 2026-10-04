"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

/**
 * Sign-in screen.
 *
 * Google OAuth is the real authentication path. The password-less "demo account"
 * form only renders when the server has explicitly enabled it, and it never
 * asks for or stores a password.
 */
export function LoginForm({
  googleEnabled,
  demoEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  demoEnabled: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState<"google" | "demo" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    setBusy("google");
    await signIn("google", { callbackUrl });
  };

  const signInAsDemo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter the work email of a seeded demo account.");
      return;
    }
    setError(null);
    setBusy("demo");
    const result = await signIn("demo", { email: email.trim(), redirect: false });
    if (result?.error) {
      setError(
        "That email is not a known demo account. Run `npm run seed` and try again."
      );
      setBusy(null);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md">
      <div className="card p-7">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Use your work Google account. No password is ever stored by this application.
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink" role="alert">
            {error}
          </div>
        ) : null}

        {googleEnabled ? (
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy !== null}
            className="btn-secondary mt-6 w-full py-2.5"
          >
            <GoogleMark />
            {busy === "google" ? "Redirecting to Google…" : "Continue with Google"}
          </button>
        ) : (
          <div className="mt-6 rounded-lg border border-warning/25 bg-warning-soft px-3.5 py-3 text-sm text-warning-ink">
            <p className="font-semibold">Google OAuth is not configured</p>
            <p className="mt-1 text-xs leading-relaxed">
              Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and{" "}
              <code className="font-mono">GOOGLE_CLIENT_SECRET</code> to{" "}
              <code className="font-mono">.env.local</code> to enable Google sign-in.
            </p>
          </div>
        )}

        {demoEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" aria-hidden />
              <span className="text-xs uppercase tracking-wide text-ink-400">
                Development demo
              </span>
              <span className="h-px flex-1 bg-ink-200" aria-hidden />
            </div>

            <form onSubmit={signInAsDemo}>
              <label htmlFor="demo-email" className="label">
                Seeded demo account email
              </label>
              <input
                id="demo-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex.morgan@skillalloc.dev"
                className="input"
                autoComplete="off"
              />
              <p className="help-text">
                Development only. This resolves an existing user by email — no password is
                requested or stored.
              </p>
              <button
                type="submit"
                disabled={busy !== null}
                className="btn-primary mt-4 w-full py-2.5"
              >
                {busy === "demo" ? "Signing in…" : "Continue as demo user"}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 01-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 01-10.7-3.8h-4v3.1A12 12 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3a7.1 7.1 0 010-4.6v-3h-4a12 12 0 000 10.6l4-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1A7.2 7.2 0 0112 4.8z"
      />
    </svg>
  );
}