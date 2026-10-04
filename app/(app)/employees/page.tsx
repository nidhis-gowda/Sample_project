import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { requirePageUser } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { listDepartments } from "@/services/departmentService";
import { listSkills } from "@/services/skillService";
import { EmployeeDirectory } from "@/components/employees/EmployeeDirectory";
import { TableSkeleton } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requirePageUser("employee:read");

  // Reference data for the filter selects — small, cached collections.
  const [departments, skills] = await Promise.all([
    listDepartments(),
    listSkills({ pageSize: 200, sort: "name" }),
  ]);

  const canCreate = can(user.role, "employee:create");
  const canManage = can(user.role, "employee:update");
  const canDelete = can(user.role, "employee:delete");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">Employees</h1>
          <p className="section-subtitle">
            Search the directory, filter by capability and open a profile to see skills,
            workload and current projects.
          </p>
        </div>
        {canCreate ? (
          <Link href="/employees/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" aria-hidden />
            Add employee
          </Link>
        ) : null}
      </header>

      <Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
        <EmployeeDirectory
          departments={departments.map((department) => ({
            id: department.id,
            name: department.name,
          }))}
          skills={skills.items.map((skill) => ({ id: skill.id, name: skill.name }))}
          canManage={canManage}
          canDelete={canDelete}
        />
      </Suspense>
    </div>
  );
}