"use client";

import * as React from "react";
import { useApiData, useDebounced } from "@/hooks/useApiData";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProgressBar,
  TableSkeleton,
  Avatar,
} from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { UTILIZATION_BAND_LABELS, UTILIZATION_BANDS, type UtilizationBand } from "@/types";
import type { WorkloadRow } from "@/services/workloadService";
import { JOB_ROLE_LABELS, type JobRole } from "@/types";
import { UTILIZATION_STYLES, workloadBarColor } from "@/utils/badges";
import { formatPercent } from "@/utils/format";

/** Live workload table. Numbers always come from active allocations. */

interface WorkloadResponse {
  rows: WorkloadRow[];
  summary: {
    totalEmployees: number;
    available: number;
    moderate: number;
    high: number;
    overallocated: number;
    averageUtilization: number;
  };
}

export function WorkloadTable({
  departments,
  isEmployee,
}: {
  departments: Array<{ id: string; name: string }>;
  /** An EMPLOYEE only ever sees their own row (enforced server-side too). */
  isEmployee: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [band, setBand] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");

  const debounced = useDebounced(search, 300);

  const query = new URLSearchParams();
  if (debounced.trim()) query.set("search", debounced.trim());
  if (band) query.set("band", band);
  if (departmentId) query.set("departmentId", departmentId);

  const path = isEmployee
    ? "/api/workload"
    : `/api/workload${query.toString() ? `?${query}` : ""}`;

  const { data, loading, error } = useApiData<WorkloadResponse>(path);
  const rows = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {summary && !isEmployee ? <SummaryTiles summary={summary} /> : null}

      <Card>
        <CardHeader
          title="Workload"
          subtitle={
            loading
              ? "Loading..."
              : `${rows.length} employee${rows.length === 1 ? "" : "s"}`
          }
        />

        {!isEmployee ? (
          <div className="grid gap-3 border-b border-ink-200 p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="workload-search" className="label">
                Search
              </label>
              <Input
                id="workload-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email or employee ID"
              />
            </div>
            <div>
              <label htmlFor="workload-band" className="label">
                Utilisation band
              </label>
              <Select
                id="workload-band"
                value={band}
                onChange={(event) => setBand(event.target.value)}
              >
                <option value="">Any band</option>
                {UTILIZATION_BANDS.map((value) => (
                  <option key={value} value={value}>
                    {UTILIZATION_BAND_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="workload-department" className="label">
                Department
              </label>
              <Select
                id="workload-department"
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
          </div>
        ) : null}

        {loading && !data ? (
          <TableSkeleton rows={8} columns={5} />
        ) : error ? (
          <ErrorState message={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No workload records"
            description="Nothing matched the current filters."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Allocated to</th>
                  <th>Total workload</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employeeId}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={row.employeeName} size="sm" />
                        <div className="min-w-0">
                          <a
                            href={`/employees/${row.employeeId}`}
                            className="link font-medium"
                          >
                            {row.employeeName}
                          </a>
                          <p className="text-xs text-ink-500">{row.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{JOB_ROLE_LABELS[row.jobRole as JobRole]}</td>
                    <td className="text-sm">{row.departmentName ?? "-"}</td>
                    <td>
                      {row.projects.length === 0 ? (
                        <span className="text-xs text-ink-400">Unallocated</span>
                      ) : (
                        <ul className="space-y-1">
                          {row.projects.map((project) => (
                            <li key={project.projectId} className="text-xs text-ink-600">
                              <a href={`/projects/${project.projectId}`} className="link">
                                {project.projectName}
                              </a>{" "}
                              <span className="text-ink-400">
                                {project.allocationPercent}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="w-40">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={Math.min(100, row.totalAllocation)}
                          colorClass={workloadBarColor(row.totalAllocation)}
                          className="h-1.5 flex-1"
                          label={`${row.employeeName} workload`}
                        />
                        <span className="w-12 text-right text-xs tabular-nums text-ink-700">
                          {formatPercent(row.totalAllocation)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge className={UTILIZATION_STYLES[row.utilizationBand]}>
                        {UTILIZATION_BAND_LABELS[row.utilizationBand as UtilizationBand]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryTiles({
  summary,
}: {
  summary: WorkloadResponse["summary"];
}) {
  const tiles = [
    { label: "Average utilisation", value: `${summary.averageUtilization}%` },
    { label: "Available (0-60%)", value: summary.available },
    { label: "Moderate (61-80%)", value: summary.moderate },
    { label: "High (81-100%)", value: summary.high },
    { label: "Overallocated", value: summary.overallocated },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="card p-4">
          <p className="text-xs text-ink-500">{tile.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">
            {tile.value}
          </p>
        </div>
      ))}
    </div>
  );
}