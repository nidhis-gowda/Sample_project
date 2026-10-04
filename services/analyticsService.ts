import { Types } from "mongoose";
import { HttpError } from "@/lib/api/http-error";
import { requirePermission, type SessionUser } from "@/lib/auth/rbac";
import { AllocationModel } from "@/models/Allocation";
import { EmployeeModel } from "@/models/Employee";
import { ProjectModel } from "@/models/Project";
import { SkillModel } from "@/models/Skill";
import { WorkloadModel } from "@/models/Workload";
import { NotificationModel } from "@/models/Notification";
import { UserModel } from "@/models/User";
import { getMatchInputsByIds } from "@/services/employeeService";
import { computeTeamCoverage } from "@/lib/matching/team";
import type { TeamCoverageSkill } from "@/types/matching";

/**
 * Analytics + reporting helpers shared by the dashboard, the skill-gap screens
 * and the downloadable reports. Everything here is read-only aggregation.
 */

/** Projects the user is allowed to analyse (null == no restriction). */
async function managedProjectIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "ADMIN") return null;
  const rows = await ProjectModel.find({ managerId: user.id })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();
  return rows.map((row) => String(row._id));
}

/** Employee ids the user may see individually (employees only see themselves). */
async function visibleEmployeeIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "ADMIN" || user.role === "PROJECT_MANAGER") return null;
  return user.employeeId ? [user.employeeId] : [];
}

export interface AnalyticsScope {
  projectIds: string[] | null;
  employeeIds: string[] | null;
}

export async function resolveScope(user: SessionUser): Promise<AnalyticsScope> {
  const [projectIds, employeeIds] = await Promise.all([
    managedProjectIds(user),
    visibleEmployeeIds(user),
  ]);
  return { projectIds, employeeIds };
}

/* ------------------------------------------------------------------ */
/* Skill gaps                                                          */
/* ------------------------------------------------------------------ */

export interface SkillGapRow {
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string;
  status: string;
  priority: string;
  deadline: string;
  daysRemaining: number;
  allocatedCount: number;
  requiredTeamSize: number;
  overallCoveragePercent: number;
  requiredCoveragePercent: number;
  missingSkills: string[];
  gaps: TeamCoverageSkill[];
}

/**
 * For every in-scope project, compares the required skills with the skills of
 * the team that is actually allocated to it.
 */
export async function skillGapRows(
  user: SessionUser,
  options: { projectId?: string } = {}
): Promise<SkillGapRow[]> {
  await requirePermission("skillgap:read");
  const { projectIds } = await resolveScope(user);

  const filter: Record<string, unknown> = {
    status: { $nin: ["COMPLETED", "CANCELLED"] },
  };
  if (options.projectId) filter._id = options.projectId;
  else if (projectIds !== null) {
    if (projectIds.length === 0) return [];
    filter._id = { $in: projectIds };
  }

  const projects = await ProjectModel.find(filter).sort({ deadline: 1 }).lean();
  if (projects.length === 0) return [];

  const ids = projects.map((project) => String(project._id));
  const objectIds = ids.map((id) => new Types.ObjectId(id));

  const [allocations, skillDocs] = await Promise.all([
    AllocationModel.aggregate<{
      _id: Types.ObjectId;
      allocatedCount: number;
      employeeIds: Types.ObjectId[];
    }>([
      { $match: { status: "ACTIVE", projectId: { $in: objectIds } } },
      {
        $group: {
          _id: "$projectId",
          allocatedCount: { $sum: 1 },
          employeeIds: { $addToSet: "$employeeId" },
        },
      },
    ]),
    SkillModel.find({}, { name: 1, category: 1 }).lean(),
  ]);

  const allocationByProject = new Map(
    allocations.map((row) => [String(row._id), row])
  );
  const skillMeta = new Map(
    skillDocs.map((skill) => [
      String(skill._id),
      { name: skill.name, category: skill.category },
    ])
  );

  const allEmployeeIds = [
    ...new Set(allocations.flatMap((row) => row.employeeIds.map(String))),
  ];
  const members = allEmployeeIds.length > 0 ? await getMatchInputsByIds(allEmployeeIds) : [];
  const memberById = new Map(members.map((member) => [member.employeeId, member]));

  const rows: SkillGapRow[] = [];
  for (const project of projects) {
    const projectId = String(project._id);
    const allocation = allocationByProject.get(projectId);
    const teamMembers = (allocation?.employeeIds ?? [])
      .map((id) => memberById.get(String(id)))
      .filter((member): member is NonNullable<typeof member> => Boolean(member));

    const requirements = project.requirements.map((requirement) => {
      const meta = skillMeta.get(String(requirement.skillId));
      return {
        skillId: String(requirement.skillId),
        skillName: meta?.name ?? "Unknown skill",
        category: (meta?.category ?? "Programming") as TeamCoverageSkill["category"],
        requiredProficiency: requirement.requiredProficiency,
        importance: requirement.importance,
      };
    });

    const coverage = computeTeamCoverage(requirements, teamMembers);

    rows.push({
      projectId,
      projectCode: project.code,
      projectName: project.name,
      clientName: project.clientName,
      status: project.status,
      priority: project.priority,
      deadline: project.deadline.toISOString(),
      daysRemaining: Math.ceil(
        (project.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
      allocatedCount: allocation?.allocatedCount ?? 0,
      requiredTeamSize: project.requiredTeamSize,
      overallCoveragePercent: coverage.overallCoveragePercent,
      requiredCoveragePercent: coverage.requiredCoveragePercent,
      missingSkills: coverage.gaps.map((gap) => gap.skillName),
      gaps: coverage.gaps,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Reporting rows                                                      */
/* ------------------------------------------------------------------ */

export interface AllocationReportRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  jobRole: string;
  projectCode: string;
  projectName: string;
  roleInProject: string;
  allocationPercent: number;
  totalAllocation: number;
  utilizationBand: string;
  startDate: string;
  status: string;
}

function populatedId(value: unknown): string {
  if (value && typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

export async function allocationReportRows(
  user: SessionUser
): Promise<AllocationReportRow[]> {
  await requirePermission("report:read");
  const employeeIds = await visibleEmployeeIds(user);

  const filter: Record<string, unknown> = {};
  if (employeeIds !== null) {
    if (employeeIds.length === 0) return [];
    filter.employeeId = { $in: employeeIds.map((id) => new Types.ObjectId(id)) };
  }

  const docs = await AllocationModel.find(filter)
    .populate("employeeId", "name employeeId jobRole")
    .populate("projectId", "name code")
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean<Array<Record<string, unknown>>>();

  const workload = await WorkloadModel.find(
    employeeIds === null ? {} : { employeeId: { $in: employeeIds } }
  )
    .select("employeeId totalAllocation utilizationBand")
    .lean<Array<{ employeeId: unknown; totalAllocation: number; utilizationBand: string }>>();
  const workloadByEmployee = new Map(workload.map((row) => [String(row.employeeId), row]));

  return docs.map((doc) => {
    const employee = doc.employeeId as Record<string, unknown> | null;
    const project = doc.projectId as Record<string, unknown> | null;
    const snapshot = workloadByEmployee.get(populatedId(doc.employeeId));
    return {
      employeeId: populatedId(doc.employeeId),
      employeeCode: (employee?.employeeId as string) ?? "—",
      employeeName: (employee?.name as string) ?? "Unknown employee",
      jobRole: (employee?.jobRole as string) ?? "—",
      projectCode: (project?.code as string) ?? "—",
      projectName: (project?.name as string) ?? "Unknown project",
      roleInProject: String(doc.roleInProject ?? "—"),
      allocationPercent: Number(doc.allocationPercent ?? 0),
      totalAllocation: snapshot?.totalAllocation ?? 0,
      utilizationBand: snapshot?.utilizationBand ?? "AVAILABLE",
      startDate: new Date(doc.startDate as string).toISOString().slice(0, 10),
      status: String(doc.status ?? "ACTIVE"),
    };
  });
}

export interface ProjectStaffingReportRow {
  projectCode: string;
  projectName: string;
  clientName: string;
  status: string;
  priority: string;
  startDate: string;
  deadline: string;
  progress: number;
  requiredTeamSize: number;
  allocatedCount: number;
  totalAllocationPercent: number;
  staffingPercent: number;
  coveragePercent: number;
  missingSkills: string;
}

export async function projectStaffingReportRows(
  user: SessionUser
): Promise<ProjectStaffingReportRow[]> {
  const gaps = await skillGapRows(user);
  if (gaps.length === 0) return [];

  const { getStaffing } = await import("@/services/projectService");
  const projects = await ProjectModel.find({
    _id: { $in: gaps.map((row) => new Types.ObjectId(row.projectId)) },
  })
    .select(
      "name code clientName status priority startDate deadline progress requiredTeamSize"
    )
    .lean<Array<Record<string, unknown>>>();

  const gapById = new Map(gaps.map((gap) => [gap.projectId, gap]));

  const rows: ProjectStaffingReportRow[] = [];
  for (const project of projects) {
    const id = String(project._id);
    const gap = gapById.get(id);
    const staffing = await getStaffing(id);
    const requiredTeamSize = Number(project.requiredTeamSize ?? 0);
    rows.push({
      projectCode: String(project.code),
      projectName: String(project.name),
      clientName: String(project.clientName),
      status: String(project.status),
      priority: String(project.priority),
      startDate: new Date(project.startDate as string).toISOString().slice(0, 10),
      deadline: new Date(project.deadline as string).toISOString().slice(0, 10),
      progress: Number(project.progress ?? 0),
      requiredTeamSize,
      allocatedCount: staffing.allocatedCount,
      totalAllocationPercent: staffing.totalAllocationPercent,
      staffingPercent:
        requiredTeamSize > 0
          ? Math.round(
              (staffing.totalAllocationPercent / 100 / requiredTeamSize) * 100
            )
          : 0,
      coveragePercent: gap?.overallCoveragePercent ?? 0,
      missingSkills: (gap?.missingSkills ?? []).join("; "),
    });
  }
  return rows;
}


/* ------------------------------------------------------------------ */
/* Admin helpers                                                       */
/* ------------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: string | null;
  lastLoginAt: string | null;
}

export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const [users, employees] = await Promise.all([
    UserModel.find().sort({ createdAt: -1 }).lean(),
    EmployeeModel.find({}, { userId: 1 }).lean(),
  ]);

  const employeeByUser = new Map(
    employees
      .filter((employee) => employee.userId)
      .map((employee) => [String(employee.userId), String(employee._id)])
  );

  return users.map((user) => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    employeeId: employeeByUser.get(String(user._id)) ?? null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  }));
}

export async function updateUserAccount(
  id: string,
  input: { role?: string; isActive?: boolean; name?: string }
): Promise<AdminUserRow> {
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid user identifier.");
  const user = await UserModel.findById(id);
  if (!user) throw HttpError.notFound("That user does not exist.");

  if (input.role !== undefined) user.role = input.role as typeof user.role;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  if (input.name !== undefined) user.name = input.name;
  await user.save();

  const employee = await EmployeeModel.findOne({ userId: user._id }).select("_id").lean();
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    employeeId: employee ? String(employee._id) : null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}

export async function pendingNotificationCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({ userId, read: false });
}
