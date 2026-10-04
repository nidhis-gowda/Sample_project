import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { listDepartments } from "@/services/departmentService";
import { listSkills } from "@/services/skillService";
import { EmployeeForm } from "@/components/employees/EmployeeForm";

export const metadata: Metadata = { title: "Add employee" };
export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  // Hard gate before rendering. `requirePageUser` redirects to /unauthorized
  // rather than throwing, so an EMPLOYEE gets a friendly page instead of a 500.
  await requirePageUser("employee:create");

  const [departments, skills] = await Promise.all([
    listDepartments(),
    listSkills({ pageSize: 200, sort: "name" }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="section-title">Add an employee</h1>
        <p className="section-subtitle">
          Create a profile, record their skills and set their initial availability. The
          employee ID is generated automatically.
        </p>
      </header>

      <EmployeeForm
        employee={null}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        skills={skills.items.map((skill) => ({
          id: skill.id,
          name: skill.name,
          category: skill.category,
        }))}
      />
    </div>
  );
}