import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { listDepartments } from "@/services/departmentService";
import { WorkloadTable } from "@/components/workload/WorkloadTable";

export const metadata: Metadata = { title: "Workload" };
export const dynamic = "force-dynamic";

export default async function WorkloadPage() {
  const user = await requirePageUser("workload:read");
  const departments = await listDepartments();
  const isEmployee = user.role === "EMPLOYEE";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Workload</h1>
        <p className="section-subtitle">
          {isEmployee
            ? "Your current allocations and how much capacity is left."
            : "Every employee's total allocation, banded as Available, Moderate, High or Overallocated."}
        </p>
      </header>

      <WorkloadTable
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        isEmployee={isEmployee}
      />
    </div>
  );
}