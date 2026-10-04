import Link from "next/link";
import { Badge, EmptyState } from "@/components/ui/Card";
import { PROJECT_PRIORITY_STYLES, PROJECT_STATUS_STYLES, coverageBarColor } from "@/utils/badges";
import {
  PROJECT_STATUS_LABELS,
  type ProjectPriority,
  type ProjectStatus,
} from "@/types";
import { formatDate, formatPercent } from "@/utils/format";
import type {
  DeadlineRow,
  PortfolioRow,
  UnderstaffedRow,
} from "@/services/dashboardService";

/** Presentational tables for the dashboard — no data fetching lives here. */

function DeadlineCell({ daysRemaining }: { daysRemaining: number }) {
  return (
    <p className="text-xs text-ink-500">
      {daysRemaining < 0
        ? `${Math.abs(daysRemaining)}d overdue`
        : daysRemaining === 0
          ? "Due today"
          : `${daysRemaining}d left`}
    </p>
  );
}

function StaffingCell({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${coverageBarColor(percent)}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-ink-500">{formatPercent(percent)}</span>
    </div>
  );
}

export function DeadlineTable({ rows }: { rows: DeadlineRow[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Deadline</th>
            <th>Staffing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => (
            <tr key={project.id}>
              <td>
                <Link href={`/projects/${project.id}`} className="link font-medium">
                  {project.name}
                </Link>
                <p className="text-xs text-ink-500">{project.code}</p>
              </td>
              <td>
                <Badge className={PROJECT_STATUS_STYLES[project.status as ProjectStatus]}>
                  {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                </Badge>
              </td>
              <td>
                <Badge className={PROJECT_PRIORITY_STYLES[project.priority as ProjectPriority]}>
                  {project.priority}
                </Badge>
              </td>
              <td>
                <p className="text-sm">{formatDate(project.deadline)}</p>
                <DeadlineCell daysRemaining={project.daysRemaining} />
              </td>
              <td className="w-32">
                <StaffingCell percent={project.staffingPercent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Progress</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => (
            <tr key={project.id}>
              <td>
                <Link href={`/projects/${project.id}`} className="link font-medium">
                  {project.name}
                </Link>
                <p className="text-xs text-ink-500">{project.code}</p>
              </td>
              <td>
                <Badge className={PROJECT_STATUS_STYLES[project.status as ProjectStatus]}>
                  {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                </Badge>
              </td>
              <td>
                <Badge className={PROJECT_PRIORITY_STYLES[project.priority as ProjectPriority]}>
                  {project.priority}
                </Badge>
              </td>
              <td className="w-40">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-ink-500">{project.progress}%</span>
                </div>
              </td>
              <td className="text-sm">{formatDate(project.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UnderstaffedList({ rows }: { rows: UnderstaffedRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Every project is fully staffed"
        description="Nothing needs more people right now."
      />
    );
  }

  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projects/${project.id}`}
            className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50"
          >
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warning"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-800">
                {project.name}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                {project.allocatedCount} of {project.requiredTeamSize} allocated
                {project.daysRemaining < 0
                  ? ` · ${Math.abs(project.daysRemaining)}d overdue`
                  : ` · ${project.daysRemaining}d left`}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}