import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePageUser("settings:manage");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="section-title">System settings</h1>
        <p className="section-subtitle">
          Defaults applied to new accounts, workload thresholds and the weights behind the
          System Matching Score.
        </p>
      </header>

      <SettingsEditor />
    </div>
  );
}