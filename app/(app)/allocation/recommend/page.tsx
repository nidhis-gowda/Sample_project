import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { listProjects } from "@/services/projectService";
import { listDepartments } from "@/services/departmentService";
import { listSkills } from "@/services/skillService";
import { RecommendationWorkspace } from "@/components/matching/RecommendationWorkspace";

export const metadata: Metadata = { title: "Employee recommendations" };
export const dynamic = "force-dynamic";

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requirePageUser("project:read");
  const { projectId } = await searchParams;

  const [projects, departments, skills] = await Promise.all([
    listProjects({
      pageSize: 200,
      sort: "deadline",
      direction: "asc",
      ...(user.role === "PROJECT_MANAGER" ? { managerId: user.id } : {}),
    }),
    listDepartments(),
    listSkills({ pageSize: 200, sort: "name" }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Employee recommendations</h1>
        <p className="section-subtitle">
          A transparent System Matching Score from 0 to 100, with every component and the
          reason for each recommendation shown.
        </p>
      </header>

      <RecommendationWorkspace
        projects={projects.items}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        skills={skills.items.map((skill) => ({ id: skill.id, name: skill.name }))}
        initialProjectId={projectId}
        canAllocate={can(user.role, "allocation:manage")}
      />
    </div>
  );
}