import { requirePermission, type SessionUser } from "@/lib/auth/rbac";
import { HttpError } from "@/lib/api/http-error";
import { buildPdfReport, toCsv, type ReportColumn, type ReportSpec } from "@/utils/report";
import { humanize } from "@/utils/format";
import { allocationReportRows, projectStaffingReportRows, skillGapRows } from "@/services/analyticsService";
import { listWorkloadRows } from "@/services/workloadService";

/**
 * Downloadable reports.
 *
 * Everything is produced in-process with `pdf-lib` (PDF) and a hand rolled CSV
 * writer — no paid service, no external queue, no temporary files.
 */

export const REPORT_TYPES = [
  "allocations",
  "project-staffing",
  "skill-gaps",
  "workload",
  "utilization",
  "project-progress",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  allocations: "Employee allocation",
  "project-staffing": "Project staffing",
  "skill-gaps": "Skill gaps",
  workload: "Workload",
  utilization: "Employee utilization",
  "project-progress": "Project progress",
};

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

type Row = Record<string, unknown>;

const pct = (row: Row, key: string) => `${row[key] ?? 0}%`;

/** Builds the table layout for a report type. */
async function buildSpec(type: ReportType, user: SessionUser): Promise<ReportSpec<Row>> {
  await requirePermission("report:read");
  const author = user.name ?? user.email ?? undefined;

  switch (type) {
    case "allocations": {
      const rows = (await allocationReportRows(user)) as unknown as Row[];
      const columns: ReportColumn<Row>[] = [
        { key: "employeeCode", label: "Employee ID", weight: 1 },
        { key: "employeeName", label: "Employee", weight: 1.4 },
        { key: "jobRole", label: "Role", weight: 1.1, format: (row) => humanize(String(row.jobRole)) },
        { key: "projectCode", label: "Project", weight: 0.9 },
        { key: "projectName", label: "Project name", weight: 1.4 },
        { key: "roleInProject", label: "Position", weight: 1.2 },
        { key: "allocationPercent", label: "Alloc %", weight: 0.7, align: "right", format: (row) => pct(row, "allocationPercent") },
        { key: "totalAllocation", label: "Total %", weight: 0.7, align: "right", format: (row) => pct(row, "totalAllocation") },
        { key: "utilizationBand", label: "Band", weight: 0.9, format: (row) => humanize(String(row.utilizationBand)) },
        { key: "status", label: "Status", weight: 0.8, format: (row) => humanize(String(row.status)) },
      ];
      return {
        title: "Employee allocation report",
        subtitle: "Every allocation with the employee's total workload",
        columns,
        rows,
        generatedBy: author,
      };
    }

    case "project-staffing": {
      const rows = (await projectStaffingReportRows(user)) as unknown as Row[];
      const columns: ReportColumn<Row>[] = [
        { key: "projectCode", label: "Code", weight: 0.8 },
        { key: "projectName", label: "Project", weight: 1.5 },
        { key: "clientName", label: "Client", weight: 1.2 },
        { key: "status", label: "Status", weight: 0.9, format: (row) => humanize(String(row.status)) },
        { key: "priority", label: "Priority", weight: 0.8, format: (row) => humanize(String(row.priority)) },
        { key: "deadline", label: "Deadline", weight: 0.9 },
        { key: "requiredTeamSize", label: "Required", weight: 0.7, align: "right" },
        { key: "allocatedCount", label: "Allocated", weight: 0.8, align: "right" },
        { key: "staffingPercent", label: "Staffing %", weight: 0.8, align: "right", format: (row) => pct(row, "staffingPercent") },
        { key: "coveragePercent", label: "Skill cov %", weight: 0.9, align: "right", format: (row) => pct(row, "coveragePercent") },
        { key: "missingSkills", label: "Missing skills", weight: 1.5 },
      ];
      return {
        title: "Project staffing report",
        subtitle: "Required versus allocated capacity and skill coverage",
        columns,
        rows,
        generatedBy: author,
      };
    }
case "skill-gaps": {
      const rows = (await skillGapRows(user)) as unknown as Row[];
      const columns: ReportColumn<Row>[] = [
        { key: "projectCode", label: "Code", weight: 0.8 },
        { key: "projectName", label: "Project", weight: 1.5 },
        { key: "clientName", label: "Client", weight: 1.2 },
        { key: "deadline", label: "Deadline", weight: 0.9 },
        { key: "daysRemaining", label: "Days left", weight: 0.8, align: "right" },
        { key: "overallCoveragePercent", label: "Coverage %", weight: 0.9, align: "right", format: (row) => pct(row, "overallCoveragePercent") },
        { key: "requiredCoveragePercent", label: "Required %", weight: 0.9, align: "right", format: (row) => pct(row, "requiredCoveragePercent") },
        {
          key: "missingSkills",
          label: "Open gaps",
          weight: 2,
          format: (row) => {
            const gaps = row.missingSkills as string[] | undefined;
            return gaps && gaps.length > 0 ? gaps.join(", ") : "None";
          },
        },
      ];
      return {
        title: "Skill gap analysis",
        subtitle: "Uncovered project requirements by project",
        columns,
        rows,
        generatedBy: author,
      };
    }

    case "workload":
    case "utilization": {
      const rows = await listWorkloadRows({});
      const scoped =
        user.role === "EMPLOYEE"
          ? rows.filter((row) => row.employeeId === user.employeeId)
          : rows;

      const mapped: Row[] = scoped.map((row) => ({
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        jobRole: row.jobRole,
        departmentName: row.departmentName ?? "Unassigned",
        availabilityPercent: row.availabilityPercent,
        totalAllocation: row.totalAllocation,
        utilizationBand: row.utilizationBand,
        activeProjectCount: row.activeProjectCount,
        projects: row.projects.map((project) => project.projectName).join("; "),
      }));

      const columns: ReportColumn<Row>[] = [
        { key: "employeeCode", label: "Employee ID", weight: 1 },
        { key: "employeeName", label: "Employee", weight: 1.4 },
        { key: "jobRole", label: "Role", weight: 1.2, format: (row) => humanize(String(row.jobRole)) },
        { key: "departmentName", label: "Department", weight: 1.1 },
        { key: "totalAllocation", label: "Workload %", weight: 0.9, align: "right", format: (row) => pct(row, "totalAllocation") },
        { key: "availabilityPercent", label: "Availability %", weight: 1, align: "right", format: (row) => pct(row, "availabilityPercent") },
        { key: "utilizationBand", label: "Band", weight: 1, format: (row) => humanize(String(row.utilizationBand)) },
        { key: "activeProjectCount", label: "Projects", weight: 0.7, align: "right" },
        { key: "projects", label: "Allocated to", weight: 2 },
      ];
      return {
        title: type === "workload" ? "Workload report" : "Employee utilization report",
        subtitle: "Allocation totals computed from active allocations",
        columns,
        rows: mapped,
        generatedBy: author,
      };
    }

    case "project-progress": {
      const rows = (await projectStaffingReportRows(user)) as unknown as Row[];
      const columns: ReportColumn<Row>[] = [
        { key: "projectCode", label: "Code", weight: 0.8 },
        { key: "projectName", label: "Project", weight: 1.6 },
        { key: "clientName", label: "Client", weight: 1.2 },
        { key: "status", label: "Status", weight: 0.9, format: (row) => humanize(String(row.status)) },
        { key: "startDate", label: "Start", weight: 0.9 },
        { key: "deadline", label: "Deadline", weight: 0.9 },
        { key: "progress", label: "Progress %", weight: 0.9, align: "right", format: (row) => pct(row, "progress") },
        { key: "allocatedCount", label: "Team size", weight: 0.8, align: "right" },
      ];
      return {
        title: "Project progress report",
        subtitle: "Status, schedule and current team size",
        columns,
        rows,
        generatedBy: author,
      };
    }

    default:
      throw HttpError.badRequest("Unknown report type.");
  }
}

export async function renderCsv(type: ReportType, user: SessionUser): Promise<string> {
  const spec = await buildSpec(type, user);
  return toCsv(spec.columns as ReportColumn<Row>[], spec.rows);
}

export async function renderPdf(
  type: ReportType,
  user: SessionUser
): Promise<Uint8Array> {
  const spec = await buildSpec(type, user);
  return buildPdfReport(spec as ReportSpec<Row>);
}