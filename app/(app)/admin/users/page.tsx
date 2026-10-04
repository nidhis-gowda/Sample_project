import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { UserManager } from "@/components/admin/UserManager";

export const metadata: Metadata = { title: "User management" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requirePageUser("user:manage");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">User accounts</h1>
        <p className="section-subtitle">
          Accounts are created automatically the first time someone signs in with Google.
          Assign roles here; the change takes effect within two minutes without a
          re-login.
        </p>
      </header>

      <UserManager currentUserId={user.id} />
    </div>
  );
}