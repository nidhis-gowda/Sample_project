import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact } from "@/lib/db/query";
import { AllocationModel, type AllocationDoc } from "@/models/Allocation";
import { EmployeeModel } from "@/models/Employee";
import { ProjectModel } from "@/models/Project";
import {
  computeAllocationTotals,
  refreshWorkloadSnapshot,
} from "@/services/workloadService";
import {
  notifyProjectAssignment,
} from "@/services/notificationService";
import type {
  AllocateTeamInput,
  CreateAllocationInput,
} from "@/lib/validators/project";
import type { AllocationDTO } from "@/types";

/**
 * Allocation service.
 *
 * Every mutation (a) validates the resulting workload so managers are warned
 * before over-allocating, (b) refreshes the workload snapshot and (c) raises a
 * notification for the affected employee.
 */

type LeanAllocation = AllocationDoc & {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId | { _id: Types.ObjectId; name: string; jobRole: string; userId?: Types.ObjectId | null };
  projectId: Types.ObjectId | { _id: Types.ObjectId; name: string; code: string };
};

function toDTO(doc: LeanAllocation): AllocationDTO {
  // `.populate()` replaces the ObjectId with a subdocument at runtime; the
  // narrow type is expressed explicitly because the model declares a ref.
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "_id" in doc.employeeId
      ? (doc.employeeId as { _id: unknown; name?: string; jobRole?: string })
      : null;
  const project =
    doc.projectId && typeof doc.projectId === "object" && "_id" in doc.projectId
      ? (doc.projectId as { _id: unknown; name?: string; code?: string })
      : null;

  return {
    id: String(doc._id),
    employeeId: employee ? String(employee._id) : String(doc.employeeId),
    employeeName: employee?.name ?? "Unknown employee",
    employeeRole: (employee?.jobRole ?? "BACKEND_DEVELOPER") as AllocationDTO["employeeRole"],
    projectId: project ? String(project._id) : String(doc.projectId),
    projectName: project?.name ?? "Unknown project",
    projectCode: project?.code ?? "—",
    allocationPercent: doc.allocationPercent,
    roleInProject: doc.roleInProject,
    startDate: doc.startDate.toISOString(),
    endDate: doc.endDate ? doc.endDate.toISOString() : null,
    status: doc.status,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
  };
}

export async function listAllocations(params: {
  projectId?: string;
  employeeId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<AllocationDTO[]> {
  await connectDB();

  const filter: FilterQuery<AllocationDoc> = {};
  if (params.projectId && Types.ObjectId.isValid(params.projectId)) {
    filter.projectId = new Types.ObjectId(params.projectId);
  }
  if (params.employeeId && Types.ObjectId.isValid(params.employeeId)) {
    filter.employeeId = new Types.ObjectId(params.employeeId);
  }
  if (params.status) filter.status = params.status as AllocationDoc["status"];

  const docs = await AllocationModel.find(filter)
    .populate("employeeId", "name jobRole")
    .populate("projectId", "name code")
    .sort({ createdAt: -1 })
    .limit(params.limit ?? 500)
    .lean();

  return docs.map((doc) => toDTO(doc as LeanAllocation));
}

/**
 * Creates an allocation after validating the resulting workload.
 * Throws 409 unless `allowOverallocated` is set by the manager.
 */
export async function createAllocation(
  projectId: string,
  input: CreateAllocationInput,
  actorId: string | null
): Promise<AllocationDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    throw HttpError.badRequest("Invalid project identifier.");
  }

  const [project, employee] = await Promise.all([
    ProjectModel.findById(projectId).lean(),
    EmployeeModel.findById(input.employeeId).lean(),
  ]);
  if (!project) throw HttpError.notFound("That project does not exist.");
  if (!employee) throw HttpError.notFound("That employee does not exist.");

  if (employee.status === "INACTIVE") {
    throw HttpError.conflict(`${employee.name} is inactive and cannot be allocated.`);
  }

  const duplicate = await AllocationModel.findOne({
    projectId,
    employeeId: input.employeeId,
    status: "ACTIVE",
  }).lean();
  if (duplicate) {
    throw HttpError.conflict(`${employee.name} is already allocated to this project.`);
  }

  const totals = await computeAllocationTotals([input.employeeId]);
  const current = totals.get(input.employeeId)?.totalAllocation ?? 0;
  const projected = Math.round((current + input.allocationPercent) * 10) / 10;

  if (projected > 100 && !input.allowOverallocated) {
    throw HttpError.conflict(
      `${employee.name} would reach ${projected}% allocation (currently ${current}%). Confirm the overallocation to continue.`
    );
  }

  const doc = await AllocationModel.create({
    employeeId: new Types.ObjectId(input.employeeId),
    projectId: new Types.ObjectId(projectId),
    allocationPercent: input.allocationPercent,
    roleInProject: input.roleInProject,
    startDate: input.startDate ?? new Date(),
    endDate: input.endDate ?? null,
    status: "ACTIVE",
    notes: input.notes ?? undefined,
    allocatedBy: actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
  });

  await refreshWorkloadSnapshot(input.employeeId);
  await notifyProjectAssignment({
    employeeUserId: employee.userId ? String(employee.userId) : null,
    projectName: project.name,
    projectId: String(project._id),
    allocationPercent: input.allocationPercent,
    roleInProject: input.roleInProject,
  });

  const created = await AllocationModel.findById(doc._id)
    .populate("employeeId", "name jobRole")
    .populate("projectId", "name code")
    .lean();
  return toDTO(created as LeanAllocation);
}

/**
 * Allocates several employees to a project in one pass.
 * Members that would exceed 100% are reported (and blocked unless the manager
 * explicitly allows overallocation).
 */
export async function allocateTeam(
  projectId: string,
  input: AllocateTeamInput,
  actorId: string | null
): Promise<{ allocations: AllocationDTO[]; warnings: string[] }> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    throw HttpError.badRequest("Invalid project identifier.");
  }

  const project = await ProjectModel.findById(projectId).lean();
  if (!project) throw HttpError.notFound("That project does not exist.");

  const employeeIds = input.members
    .map((member) => member.employeeId)
    .filter((id) => Types.ObjectId.isValid(id));

  const [employees, totals, existing] = await Promise.all([
    EmployeeModel.find({ _id: { $in: employeeIds } }).lean(),
    computeAllocationTotals(employeeIds),
    AllocationModel.find({ projectId, status: "ACTIVE" }).select("employeeId").lean(),
  ]);

  const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));
  const existingIds = new Set(existing.map((row) => String(row.employeeId)));

  const duplicates: string[] = [];
  const overflows: string[] = [];

  for (const member of input.members) {
    const employee = employeeMap.get(member.employeeId);
    if (!employee) {
      throw HttpError.badRequest("One of the selected employees no longer exists.");
    }
    if (existingIds.has(member.employeeId)) {
      duplicates.push(employee.name);
      continue;
    }
    const current = totals.get(member.employeeId)?.totalAllocation ?? 0;
    const projected = Math.round((current + member.allocationPercent) * 10) / 10;
    if (projected > 100) {
      overflows.push(`${employee.name} would reach ${projected}% (currently ${current}%)`);
    }
  }

  if (duplicates.length > 0) {
    throw HttpError.conflict(`Already allocated to this project: ${duplicates.join(", ")}.`);
  }
  if (overflows.length > 0 && !input.allowOverallocated) {
    throw HttpError.conflict(
      `These team members would be overallocated: ${overflows.join("; ")}. Confirm the overallocation to continue.`
    );
  }

  const created: AllocationDTO[] = [];
  const warnings: string[] = overflows.map((entry) => `Overallocated: ${entry}`);

  for (const member of input.members) {
    const employee = employeeMap.get(member.employeeId)!;
    const doc = await AllocationModel.create({
      employeeId: new Types.ObjectId(member.employeeId),
      projectId: new Types.ObjectId(projectId),
      allocationPercent: member.allocationPercent,
      roleInProject: member.roleInProject,
      startDate: input.startDate ?? new Date(),
      status: "ACTIVE",
      allocatedBy:
        actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null,
    });

    await refreshWorkloadSnapshot(member.employeeId);

    if (input.notify) {
      await notifyProjectAssignment({
        employeeUserId: employee.userId ? String(employee.userId) : null,
        projectName: project.name,
        projectId: String(project._id),
        allocationPercent: member.allocationPercent,
        roleInProject: member.roleInProject,
      });
    }

    const populated = await AllocationModel.findById(doc._id)
      .populate("employeeId", "name jobRole")
      .populate("projectId", "name code")
      .lean();
    created.push(toDTO(populated as LeanAllocation));
  }

  return { allocations: created, warnings };
}

export async function updateAllocation(
  id: string,
  input: {
    allocationPercent?: number;
    roleInProject?: string;
    status?: AllocationDTO["status"];
    startDate?: Date;
    endDate?: Date | null;
    notes?: string | null;
    allowOverallocated?: boolean;
  },
  actorId: string | null
): Promise<AllocationDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid allocation identifier.");

  const allocation = await AllocationModel.findById(id);
  if (!allocation) throw HttpError.notFound("That allocation does not exist.");

  if (
    input.allocationPercent !== undefined &&
    allocation.status === "ACTIVE" &&
    input.allocationPercent !== allocation.allocationPercent
  ) {
    const totals = await computeAllocationTotals([String(allocation.employeeId)]);
    const current = totals.get(String(allocation.employeeId))?.totalAllocation ?? 0;
    const projected =
      Math.round((current - allocation.allocationPercent + input.allocationPercent) * 10) / 10;
    if (projected > 100 && !input.allowOverallocated) {
      throw HttpError.conflict(
        `This change would raise the employee's total allocation to ${projected}%. Confirm the overallocation to continue.`
      );
    }
  }

  allocation.set(
    compact({
      allocationPercent: input.allocationPercent,
      roleInProject: input.roleInProject,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes ?? undefined,
    })
  );
  if (actorId && Types.ObjectId.isValid(actorId)) {
    allocation.allocatedBy = new Types.ObjectId(actorId);
  }
  await allocation.save();

  await refreshWorkloadSnapshot(String(allocation.employeeId));

  const populated = await AllocationModel.findById(id)
    .populate("employeeId", "name jobRole")
    .populate("projectId", "name code")
    .lean();
  return toDTO(populated as LeanAllocation);
}

export async function deleteAllocation(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid allocation identifier.");

  const allocation = await AllocationModel.findById(id).lean();
  if (!allocation) throw HttpError.notFound("That allocation does not exist.");

  await AllocationModel.deleteOne({ _id: id });
  await refreshWorkloadSnapshot(String(allocation.employeeId));
}

/** Head-count and allocation summary for one project. */
export async function getProjectTeamSummary(projectId: string): Promise<{
  allocations: AllocationDTO[];
  allocatedCount: number;
  totalAllocationPercent: number;
  distinctEmployees: number;
}> {
  const allocations = await listAllocations({ projectId, status: "ACTIVE" });
  const distinctEmployees = new Set(allocations.map((allocation) => allocation.employeeId)).size;
  return {
    allocations,
    allocatedCount: allocations.length,
    totalAllocationPercent:
      Math.round(allocations.reduce((sum, item) => sum + item.allocationPercent, 0) * 10) / 10,
    distinctEmployees,
  };
}