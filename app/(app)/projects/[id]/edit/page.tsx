import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { HttpError } from "@/lib/api/http-error";
import { getProjectById } from "@/services/projectService";
import { listSkills } from "@/services/skillService";
import { listEmployees } from "@/services/employeeService";
import { ProjectForm } from "@/components/projects/ProjectForm";

export const metadata: Metadata = { title: "Edit project" };
export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("project:update");
  const { id } = await params;

  let project;
  try {
    project = await getProjectById(id);
  } catch (error) {
    // Both a malformed id (400) and a missing one (404) mean "no such project".
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  const [skills, employees] = await Promise.all([
    listSkills({ pageSize: 200, sort: "name" }),
    listEmployees({ pageSize: 100, sort: "name" }),
  ]);

  const managerOptions = employees.items
    .filter((employee) => ["PROJECT_MANAGER", "TECH_LEAD"].includes(employee.jobRole))
    .map((employee) => ({ id: employee.id, name: employee.name }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="section-title">Edit {project.name}</h1>
        <p className="section-subtitle">
          {project.code} · Changes to requirements immediately affect matching.
        </p>
      </header>

      <ProjectForm
        project={project}
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