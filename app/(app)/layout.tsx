import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/rbac";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export const dynamic = "force-dynamic";

/**
 * Authenticated application shell.
 *
 * `requirePageUser` performs the real server-side authorization check (the
 * middleware only performs the coarse "is signed in" gate), and each page
 * re-checks its own permission before rendering.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requirePageUser();
  if (!user.name) redirect("/login");

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "SkillAlloc";
  const permissions = ROLE_PERMISSIONS[user.role] ?? [];

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar role={user.role} permissions={permissions} appName={appName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.name}
          email={user.email}
          image={user.image}
          role={user.role}
        />
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
        <footer className="border-t border-ink-200 bg-white px-4 py-4 lg:px-8">
          <p className="mx-auto max-w-[1400px] text-xs text-ink-400">
            {appName} — matching scores are calculated by a documented, deterministic
            scoring model and are decision support, not a measure of a person&apos;s worth.
          </p>
        </footer>
      </div>
    </div>
  );
}