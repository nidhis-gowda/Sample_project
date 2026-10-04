import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/rbac";
import { listSkills } from "@/services/skillService";
import { listEmployees } from "@/services/employeeService";
import { ProjectForm } from "@/components/projects/ProjectForm";

export const metadata: Metadata = { title: "New project" };
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requirePermission("project:create");

  const [skills, managers] = await Promise.all([
    listSkills({ pageSize: 200, sort: "name" }),
    listEmployees({
      // Only people who can actually manage a project appear here.
      pageSize: 100,
      sort: "name",
    }),
  ]);

  const managerOptions = managers.items
    .filter((employee) =>
      ["PROJECT_MANAGER", "TECH_LEAD"].includes(employee.jobRole)
    )
    .map((employee) => ({ id: employee.id, name: employee.name }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="section-title">Create a project</h1>
        <p className="section-subtitle">
          Define what the project needs. The required skills below become the input to
          the matching engine.
        </p>
      </header>

      <ProjectForm
        project={null}
        skills={skills.items.map((skill) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
        }))}
        managers={managerOptions}
      />
    </div>
  );
}