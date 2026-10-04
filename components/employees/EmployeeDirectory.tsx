"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, ApiRequestError } from "@/hooks/useApi";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { UTILIZATION_STYLES, workloadBarColor } from "@/utils/badges";
import { JOB_ROLE_LABELS, JOB_ROLES, EMPLOYEE_STATUSES, type EmployeeDTO } from "@/types";
import { formatPercent, humanize } from "@/utils/format";

/**
 * Employee directory: real server-side search, filters, sorting and pagination,
 * plus an ADMIN-only delete action. Nothing here is mocked.
 */

interface DirectoryResponse {
  items: EmployeeDTO[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const SORTABLE = [
  { value: "name", label: "Name" },
  { value: "yearsOfExperience", label: "Experience" },
  { value: "createdAt", label: "Newest" },
];

export function EmployeeDirectory({
  departments,
  skills,
  canManage,
  canDelete,
  createAction,
}: {
  departments: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  canManage: boolean;
  canDelete: boolean;
  createAction?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();

  const [search, setSearch] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [jobRole, setJobRole] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [skillId, setSkillId] = React.useState("");
  const [sort, setSort] = React.useState("name");
  const [direction, setDirection] = React.useState<"asc" | "desc">("asc");
  const [page, setPage] = React.useState(1);
  const [pendingDelete, setPendingDelete] = React.useState<EmployeeDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebounced(search, 350);

  // Any filter change returns to page 1, otherwise a narrowed result set can
  // land on an empty page.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentId, jobRole, status, skillId]);

  const query = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    sort,
    direction,
  });
  if (debouncedSearch.trim()) query.set("q", debouncedSearch.trim());
  if (departmentId) query.set("departmentId", departmentId);
  if (jobRole) query.set("jobRole", jobRole);
  if (status) query.set("status", status);
  if (skillId) query.set("skillId", skillId);

  const { data, loading, error, reload } = useApiData<DirectoryResponse>(
    `/api/employees?${query.toString()}`
  );

  const items = data?.items ?? [];
  const total = data?.meta?.total ?? 0;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/employees/${pendingDelete.id}`);
      toast.success(`${pendingDelete.name} was removed`);
      setPendingDelete(null);
      reload();
      router.refresh();
    } catch (cause) {
      toast.error(
        "Could not delete the employee",
        cause instanceof ApiRequestError && cause.status === 409
          ? cause.message
          : errorMessage(cause)
      );
    } finally {
      setDeleting(false);
    }
  };

  const hasFilters = Boolean(debouncedSearch || departmentId || jobRole || status || skillId);

  return (
    <Card>
      <CardHeader
        title="Employees"
        subtitle={loading ? "Loading..." : `${total} matching employee${total === 1 ? "" : "s"}`}
        actions={createAction}
      />

      <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="employee-search" className="label">
            Search
          </label>
          <Input
            id="employee-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or employee ID"
          />
        </div>

        <div>
          <label htmlFor="filter-department" className="label">
            Department
          </label>
          <Select
            id="filter-department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="filter-role" className="label">
            Job role
          </label>
          <Select
            id="filter-role"
            value={jobRole}
            onChange={(event) => setJobRole(event.target.value)}
          >
            <option value="">All roles</option>
            {JOB_ROLES.map((role) => (
              <option key={role} value={role}>
                {JOB_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="filter-skill" className="label">
            Skill
          </label>
          <Select
            id="filter-skill"
            value={skillId}
            onChange={(event) => setSkillId(event.target.value)}
          >
            <option value="">Any skill</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="filter-status" className="label">
            Status
          </label>
          <Select
            id="filter-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any status</option>
            {EMPLOYEE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-ink-50/60 px-4 py-2">
        <p className="text-xs text-ink-500">
          {hasFilters
            ? "Filters applied"
            : "Showing every employee you are allowed to see"}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-employees" className="text-xs text-ink-500">
            Sort by
          </label>
          <Select
            id="sort-employees"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-8 w-auto py-0 text-xs"
          >
            {SORTABLE.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => setDirection((value) => (value === "asc" ? "desc" : "asc"))}
          >
            {direction === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No employees match these filters"
          description="Try clearing a filter or searching for a different term."
        />
      ) : (
        <EmployeeTable
          items={items}
          canManage={canManage}
          canDelete={canDelete}
          onDelete={setPendingDelete}
        />
      )}

      {!loading && !error && items.length > 0 ? (
        <Pagination
          page={page}
          pageSize={data?.meta?.pageSize ?? 20}
          total={total}
          onPageChange={setPage}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        title="Delete employee"
        confirmLabel="Delete permanently"
        message={
          <>
            <p>
              This permanently removes <strong>{pendingDelete?.name}</strong> along with
              their skill and certification history.
            </p>
            <p className="mt-2">
              Employees with active allocations cannot be deleted; release those first.
            </p>
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

/** Directory table, split out so the filter state above stays readable. */
function EmployeeTable({
  items,
  canManage,
  canDelete,
  onDelete,
}: {
  items: EmployeeDTO[];
  canManage: boolean;
  canDelete: boolean;
  onDelete: (employee: EmployeeDTO) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Role</th>
            <th>Department</th>
            <th>Experience</th>
            <th>Availability</th>
            <th>Workload</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((employee) => (
            <tr key={employee.id}>
              <td>
                <div className="flex items-center gap-3">
                  <Avatar name={employee.name} src={employee.avatar} />
                  <div className="min-w-0">
                    <a href={`/employees/${employee.id}`} className="link font-medium">
                      {employee.name}
                    </a>
                    <p className="text-xs text-ink-500">{employee.employeeId}</p>
                  </div>
                </div>
              </td>
              <td className="text-sm">{JOB_ROLE_LABELS[employee.jobRole]}</td>
              <td className="text-sm">{employee.departmentName ?? "-"}</td>
              <td className="text-sm tabular-nums">
                {employee.yearsOfExperience} yr{employee.yearsOfExperience === 1 ? "" : "s"}
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-info"
                      style={{ width: `${employee.availabilityPercent}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-ink-600">
                    {formatPercent(employee.availabilityPercent)}
                  </span>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={`h-full rounded-full ${workloadBarColor(employee.totalAllocation)}`}
                      style={{ width: `${Math.min(100, employee.totalAllocation)}%` }}
                    />
                  </div>
                  <Badge className={UTILIZATION_STYLES[employee.utilizationBand]}>
                    {formatPercent(employee.totalAllocation)}
                  </Badge>
                </div>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-1.5">
                  <a href={`/employees/${employee.id}`} className="btn-secondary btn-xs">
                    View
                  </a>
                  {canManage ? (
                    <a href={`/employees/${employee.id}/edit`} className="btn-secondary btn-xs">
                      Edit
                    </a>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn-ghost btn-xs text-danger hover:bg-danger-soft"
                      onClick={() => onDelete(employee)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}