import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { canEditEmployee } from "@/lib/auth/access";
import { getEmployeeById } from "@/services/employeeService";
import { listDepartments } from "@/services/departmentService";
import { listSkills } from "@/services/skillService";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { HttpError } from "@/lib/api/http-error";

export const metadata: Metadata = { title: "Edit employee" };
export const dynamic = "force-dynamic";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let employee;
  try {
    employee = await getEmployeeById(id);
  } catch (error) {
    // Both a malformed id (400) and a missing one (404) mean "no such employee".
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  // Object-level check: an EMPLOYEE may only edit their own profile.
  const mayEdit = canEditEmployee(user, id);
  if (!mayEdit) {
    const canManageOthers = can(user.role, "employee:update");
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-6">
          <h1 className="section-title">You cannot edit this profile</h1>
          <p className="mt-2 text-sm text-ink-600">
            {canManageOthers
              ? "Your role does not include permission to edit employee records."
              : `You can only edit your own profile. Use "My profile" to update your own details, availability and skills.`}
          </p>
        </div>
      </div>
    );
  }

  const [departments, skills] = await Promise.all([
    listDepartments(),
    listSkills({ pageSize: 200, sort: "name" }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="section-title">Edit {employee.name}</h1>
        <p className="section-subtitle">
          {employee.employeeId} · Changes take effect immediately for the matching engine.
        </p>
      </header>

      <EmployeeForm
        employee={employee}
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