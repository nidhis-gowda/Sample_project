import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { listProjects } from "@/services/projectService";
import { AllocationTable } from "@/components/projects/AllocationTable";

export const metadata: Metadata = { title: "Allocation" };
export const dynamic = "force-dynamic";

export default async function AllocationPage() {
  const user = await requirePageUser("allocation:read");

  const projects = await listProjects({
    pageSize: 200,
    sort: "deadline",
    direction: "asc",
    ...(user.role === "PROJECT_MANAGER" ? { managerId: user.id } : {}),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">Allocation</h1>
          <p className="section-subtitle">
            Every employee-to-project assignment, with the percentage of time each person
            commits.
          </p>
        </div>
        {can(user.role, "allocation:manage") ? (
          <a href="/allocation/recommend" className="btn-primary">
            Build a team
          </a>
        ) : null}
      </header>

      <AllocationTable
        projects={projects.items.map((project) => ({
          id: project.id,
          code: project.code,
          name: project.name,
        }))}
        isEmployee={user.role === "EMPLOYEE"}
        canManage={can(user.role, "allocation:manage")}
      />
    </div>
  );
}