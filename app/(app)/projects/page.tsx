import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { ProjectList } from "@/components/projects/ProjectList";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requirePageUser("project:read");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Projects</h1>
        <p className="section-subtitle">
          {user.role === "PROJECT_MANAGER"
            ? "Projects you manage, plus the wider portfolio. Open one to staff it."
            : "Every project in the portfolio, with live staffing and skill coverage."}
        </p>
      </header>

      <ProjectList
        canCreate={can(user.role, "project:create")}
        showAllToggle={user.role === "PROJECT_MANAGER"}
      />
    </div>
  );
}