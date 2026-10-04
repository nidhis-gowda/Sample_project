"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@heroicons/react/24/outline";
import { api, errorMessage } from "@/hooks/useApi";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ALLOCATION_STATUSES, type AllocationDTO } from "@/types";
import { ALLOCATION_STATUS_STYLES } from "@/utils/badges";
import { formatDate, formatPercent, humanize } from "@/utils/format";

/** Allocation table with project filter, inline release and status changes. */

export function AllocationTable({
  projects,
  isEmployee,
  canManage,
}: {
  projects: Array<{ id: string; code: string; name: string }>;
  isEmployee: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [projectId, setProjectId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<AllocationDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debounced = useDebounced(search, 300);

  const query = new URLSearchParams({ limit: "300" });
  if (projectId) query.set("projectId", projectId);
  if (status) query.set("status", status);

  const { data, loading, error, reload } = useApiData<AllocationDTO[]>(
    `/api/allocations?${query}`
  );

  const rows = React.useMemo(() => {
    const all = data ?? [];
    const term = debounced.trim().toLowerCase();
    const filtered = isEmployee
      ? all.filter((row) => row.employeeName.toLowerCase().includes(term) ||
          row.projectName.toLowerCase().includes(term))
      : term
        ? all.filter(
            (row) =>
              row.employeeName.toLowerCase().includes(term) ||
              row.projectName.toLowerCase().includes(term) ||
              row.employeeRole.toLowerCase().includes(term)
          )
        : all;
    return filtered;
  }, [data, debounced, isEmployee]);

  const release = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/allocations/${pendingDelete.id}`);
      toast.success(`${pendingDelete.employeeName} released from ${pendingDelete.projectName}`);
      setPendingDelete(null);
      reload();
      router.refresh();
    } catch (cause) {
      toast.error("Could not release the allocation", errorMessage(cause));
    } finally {
      setDeleting(false);
    }
  };

  const changeStatus = async (allocation: AllocationDTO, next: string) => {
    try {
      await api.put(`/api/allocations/${allocation.id}`, { status: next });
      toast.success(
        `${allocation.employeeName}'s allocation is now ${humanize(next).toLowerCase()}`
      );
      reload();
      router.refresh();
    } catch (cause) {
      toast.error("Could not update the allocation", errorMessage(cause));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Allocations"
        subtitle={loading ? "Loading..." : `${rows.length} record(s)`}
      />

      <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="allocation-search" className="label">
            Search
          </label>
          <Input
            id="allocation-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Employee or project"
          />
        </div>
        <div>
          <label htmlFor="allocation-project" className="label">
            Project
          </label>
          <Select
            id="allocation-project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.code} - {project.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="allocation-status" className="label">
            Status
          </label>
          <Select
            id="allocation-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any status</option>
            {ALLOCATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && !data ? (
        <TableSkeleton rows={8} columns={5} />
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No allocations found"
          description="Allocate employees from the recommendation workspace to fill a project."
          action={
            <a href="/allocation/recommend" className="btn-primary">
              Find employees for a project
            </a>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Project</th>
                <th>Position</th>
                <th>Allocation</th>
                <th>Since</th>
                {canManage ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <a href={`/employees/${row.employeeId}`} className="link font-medium">
                      {row.employeeName}
                    </a>
                    <p className="text-xs text-ink-500">{humanize(row.employeeRole)}</p>
                  </td>
                  <td>
                    <a href={`/projects/${row.projectId}`} className="link">
                      {row.projectName}
                    </a>
                    <p className="text-xs text-ink-500">{row.projectCode}</p>
                  </td>
                  <td className="text-sm">{row.roleInProject}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Badge className={ALLOCATION_STATUS_STYLES[row.status]}>
                        {formatPercent(row.allocationPercent)}
                      </Badge>
                      <Badge className="badge-neutral">{humanize(row.status)}</Badge>
                    </div>
                  </td>
                  <td className="text-sm">{formatDate(row.startDate)}</td>
                  {canManage ? (
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {row.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            onClick={() => changeStatus(row, "COMPLETED")}
                          >
                            Complete
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            onClick={() => changeStatus(row, "ACTIVE")}
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost btn-xs p-1.5 text-danger hover:bg-danger-soft"
                          onClick={() => setPendingDelete(row)}
                          aria-label={`Release ${row.employeeName} from ${row.projectName}`}
                        >
                          <TrashIcon className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        busy={deleting}
        title="Release allocation"
        confirmLabel="Release"
        message={
          <>
            <p>
              <strong>{pendingDelete?.employeeName}</strong> will be released from{" "}
              <strong>{pendingDelete?.projectName}</strong> and their workload is
              recalculated immediately.
            </p>
            <p className="mt-2 text-xs text-ink-500">
              The employee is notified that the allocation has been removed.
            </p>
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={release}
      />
    </Card>
  );
}