import Link from "next/link";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { ROLE_STYLES } from "@/utils/badges";
import { USER_ROLE_LABELS, type UserRole } from "@/types";

/** Minimal marketing/utility header used by the public pages. */
export function PublicHeader({
  appName,
  signedInName,
  signedInRole,
}: {
  appName: string;
  signedInName: string | null;
  signedInRole: UserRole | null;
}) {
  return (
    <header className="border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            SA
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink-900">{appName}</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/about" className="rounded-lg px-3 py-2 text-ink-600 hover:bg-ink-100">
            About
          </Link>
          {signedInName ? (
            <>
              <span className={`badge ${ROLE_STYLES[signedInRole ?? "EMPLOYEE"]}`}>
                {USER_ROLE_LABELS[signedInRole ?? "EMPLOYEE"]}
              </span>
              <Link href="/dashboard" className="btn-primary btn-sm ml-2">
                Dashboard
                <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn-primary btn-sm ml-2">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}