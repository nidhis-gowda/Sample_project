import type { Types } from "mongoose";
import { requirePermission, type SessionUser } from "@/lib/auth/rbac";
import { AllocationModel } from "@/models/Allocation";
import { EmployeeModel } from "@/models/Employee";
import { ProjectModel } from "@/models/Project";
import { DepartmentModel } from "@/models/Department";
import { averageUtilization, computeAllocationTotals } from "@/services/workloadService";
import { employeesByDepartment, topSkills } from "@/services/employeeService";
import { projectsByStatus } from "@/services/projectService";
import { skillGapRows } from "@/services/analyticsService";
import {
  DEPARTMENT_CHART_COLORS,
  PROJECT_STATUS_ORDER,
  UTILIZATION_ORDER,
} from "@/lib/dashboard/constants";
import type { DashboardCharts, DashboardStats, UtilizationBand } from "@/types";

/**
 * Dashboard aggregation.
 *
 * Every number is computed live from MongoDB — there are no cached or hard-coded
 * metrics anywhere in this file.
 */

export interface DeadlineRow {
  id: string;
  code: string;
  name: string;
  deadline: string;
  daysRemaining: number;
  status: string;
  priority: string;
  staffingPercent: number;
}

export interface UnderstaffedRow {
  id: string;
  code: string;
  name: string;
  requiredTeamSize: number;
  allocatedCount: number;
  daysRemaining: number;
}

export interface RecentProjectRow {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string;
}

export type PortfolioRow = RecentProjectRow;

export interface DashboardPayload {
  stats: DashboardStats;
  charts: DashboardCharts;
  approachingDeadlines: DeadlineRow[];
  understaffed: UnderstaffedRow[];
  recentProjects: RecentProjectRow[];
  /** True when the caller only sees their own slice of the data. */
  scoped: boolean;
}

function bandOf(total: number): UtilizationBand {
  if (total > 100) return "OVERALLOCATED";
  if (total > 80) return "HIGH";
  if (total > 60) return "MODERATE";
  return "AVAILABLE";
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}


export async function buildDashboard(user: SessionUser): Promise<DashboardPayload> {
  await requirePermission("dashboard:read");
  const scoped = user.role === "EMPLOYEE";

  // An EMPLOYEE has no company-wide view, so their dashboard stays personal.
  const projectFilter: Record<string, unknown> =
    user.role === "PROJECT_MANAGER" ? { managerId: user.id } : {};

  const [
    totalEmployees,
    activeEmployees,
    activeProjects,
    totals,
    departmentCounts,
    skills,
    projectStatuses,
    gaps,
    departments,
  ] = await Promise.all([
    EmployeeModel.countDocuments({ status: { $ne: "INACTIVE" } }),
    EmployeeModel.countDocuments({ status: "ACTIVE" }),
    ProjectModel.countDocuments({
      ...projectFilter,
      status: { $in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
    }),
    computeAllocationTotals(),
    employeesByDepartment(),
    topSkills(10),
    projectsByStatus(),
    skillGapRows(user),
    DepartmentModel.find({}, { name: 1 }).sort({ name: 1 }).lean(),
  ]);

  const allocatedEmployees = [...totals.values()].filter(
    (value) => value.totalAllocation > 0
  ).length;
  const availableEmployees = Math.max(0, activeEmployees - allocatedEmployees);
  const averageUtilizationPercent = await averageUtilization();

  /* ---------------- Project staffing snapshot ---------------- */

  const projectDocs = await ProjectModel.find({
    ...projectFilter,
    status: { $in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
  })
    .sort({ deadline: 1 })
    .limit(50)
    .lean<Array<Record<string, unknown>>>();

  const allocationStats = await AllocationModel.aggregate<{
    _id: Types.ObjectId;
    allocatedCount: number;
    totalAllocationPercent: number;
  }>([
    {
      $match: {
        status: "ACTIVE",
        projectId: { $in: projectDocs.map((doc) => doc._id as Types.ObjectId) },
      },
    },
    {
      $group: {
        _id: "$projectId",
        allocatedCount: { $sum: 1 },
        totalAllocationPercent: { $sum: "$allocationPercent" },
      },
    },
  ]);

  const statsByProject = new Map(
    allocationStats.map((row) => [
      String(row._id),
      {
        allocatedCount: row.allocatedCount,
        peopleEquivalent: row.totalAllocationPercent / 100,
      },
    ])
  );

  const approachingDeadlines: DeadlineRow[] = [];
  const understaffed: UnderstaffedRow[] = [];

  for (const doc of projectDocs) {
    const id = String(doc._id);
    const deadline = new Date(doc.deadline as string);
    const daysRemaining = Math.ceil(
      (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const stats = statsByProject.get(id);
    const requiredTeamSize = Number(doc.requiredTeamSize ?? 0);
    const staffingPercent =
      requiredTeamSize > 0 && stats
        ? Math.round((stats.peopleEquivalent / requiredTeamSize) * 100)
        : 0;

    if (daysRemaining <= 14) {
      approachingDeadlines.push({
        id,
        code: String(doc.code),
        name: String(doc.name),
        deadline: deadline.toISOString(),
        daysRemaining,
        status: String(doc.status),
        priority: String(doc.priority),
        staffingPercent,
      });
    }

    if (requiredTeamSize > 0 && staffingPercent < 100) {
      understaffed.push({
        id,
        code: String(doc.code),
        name: String(doc.name),
        requiredTeamSize,
        allocatedCount: stats?.allocatedCount ?? 0,
        daysRemaining,
      });
    }
  }


  const allTotals = [...totals.values()];
  const utilizationValues = UTILIZATION_ORDER.map(
    (band) => allTotals.filter((value) => bandOf(value.totalAllocation) === band).length
  );

  const departmentNames = new Map(
    departments.map((department) => [String(department._id), department.name])
  );
  const departmentLabels: string[] = [];
  const departmentValues: number[] = [];
  const unassigned = departmentCounts.get("unassigned") ?? 0;
  for (const [departmentId, count] of departmentCounts) {
    if (departmentId === "unassigned") continue;
    const name = departmentNames.get(departmentId);
    if (!name) continue;
    departmentLabels.push(name);
    departmentValues.push(count);
  }
  if (unassigned > 0) {
    departmentLabels.push("Unassigned");
    departmentValues.push(unassigned);
  }

  const gapCounts = new Map<string, number>();
  for (const row of gaps) {
    for (const name of row.missingSkills) {
      gapCounts.set(name, (gapCounts.get(name) ?? 0) + 1);
    }
  }
  const topGaps = [...gapCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const topProjects = projectDocs.slice(0, 8);

  const charts: DashboardCharts = {
    utilization: { labels: [...UTILIZATION_ORDER], values: utilizationValues },
    skillDistribution: {
      labels: skills.map((skill) => skill.name),
      values: skills.map((skill) => skill.count),
    },
    projectStatus: {
      labels: PROJECT_STATUS_ORDER.map((status) => titleCase(status)),
      values: PROJECT_STATUS_ORDER.map((status) => projectStatuses.get(status) ?? 0),
    },
    departmentDistribution: { labels: departmentLabels, values: departmentValues },
    skillGaps: {
      labels: topGaps.map(([name]) => name),
      values: topGaps.map(([, count]) => count),
    },
    projectStaffing: {
      labels: topProjects.map((doc) => String(doc.code)),
      required: topProjects.map((doc) => Number(doc.requiredTeamSize ?? 0)),
      allocated: topProjects.map((doc) => {
        const stats = statsByProject.get(String(doc._id));
        return stats ? Math.round(stats.peopleEquivalent * 10) / 10 : 0;
      }),
    },
  };

  const stats: DashboardStats = {
    totalEmployees,
    availableEmployees,
    activeProjects,
    allocatedEmployees,
    averageUtilization: averageUtilizationPercent,
    openSkillGaps: gaps.reduce((sum, row) => sum + row.gaps.length, 0),
    approachingDeadlines: approachingDeadlines.length,
    understaffedProjects: understaffed.length,
  };

  return {
    stats,
    charts,
    approachingDeadlines: approachingDeadlines.slice(0, 5),
    understaffed: understaffed.slice(0, 5),
    recentProjects: projectDocs.slice(0, 6).map((doc) => ({
      id: String(doc._id),
      code: String(doc.code),
      name: String(doc.name),
      status: String(doc.status),
      priority: String(doc.priority),
      progress: Number(doc.progress ?? 0),
      deadline: new Date(doc.deadline as string).toISOString(),
    })),
    scoped,
  };
}

export { DEPARTMENT_CHART_COLORS };
