import { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { utilizationBand } from "@/lib/matching/engine";
import { AllocationModel } from "@/models/Allocation";
import { EmployeeModel, type EmployeeDoc } from "@/models/Employee";
import { WorkloadModel } from "@/models/Workload";
import type { UtilizationBand } from "@/types";

/**
 * Workload tracking.
 *
 * Two complementary mechanisms:
 *  1. `computeAllocationTotals()` — a live aggregation over ACTIVE allocations.
 *     Always accurate, used by the matching engine and the dashboards.
 *  2. The `workloads` collection — a persisted snapshot, refreshed whenever an
 *     allocation changes (and by `npm run seed`). Used by the reports and by
 *     cheap "top N overallocated" queries.
 */

export interface AllocationTotal {
  employeeId: string;
  totalAllocation: number;
  activeProjectCount: number;
  projects: Array<{ projectId: string; projectName: string; allocationPercent: number }>;
}

/** Live totals for every employee (or a subset) with ACTIVE allocations. */
export async function computeAllocationTotals(
  employeeIds?: string[]
): Promise<Map<string, AllocationTotal>> {
  await connectDB();

  const match: Record<string, unknown> = { status: "ACTIVE" };
  if (employeeIds && employeeIds.length > 0) {
    match.employeeId = {
      $in: employeeIds
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id)),
    };
  }

  const rows = await AllocationModel.aggregate<{
    _id: Types.ObjectId;
    totalAllocation: number;
    activeProjectCount: number;
    projects: Array<{ projectId: Types.ObjectId; projectName: string; allocationPercent: number }>;
  }>([
    { $match: match },
    { $sort: { allocationPercent: -1 } },
    {
      $group: {
        _id: "$employeeId",
        totalAllocation: { $sum: "$allocationPercent" },
        activeProjectCount: { $sum: 1 },
        projects: {
          $push: { projectId: "$projectId", allocationPercent: "$allocationPercent" },
        },
      },
    },
    {
      $lookup: {
        from: "projects",
        localField: "projects.projectId",
        foreignField: "_id",
        as: "projectDocs",
      },
    },
    {
      $project: {
        totalAllocation: 1,
        activeProjectCount: 1,
        projects: {
          $map: {
            input: "$projects",
            as: "entry",
            in: {
              projectId: "$$entry.projectId",
              allocationPercent: "$$entry.allocationPercent",
              projectName: {
                $let: {
                  vars: {
                    doc: {
                      $first: {
                        $filter: {
                          input: "$projectDocs",
                          as: "project",
                          cond: { $eq: ["$$project._id", "$$entry.projectId"] },
                        },
                      },
                    },
                  },
                  in: { $ifNull: ["$$doc.name", "Unknown project"] },
                },
              },
            },
          },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        employeeId: String(row._id),
        totalAllocation: Math.round(row.totalAllocation * 10) / 10,
        activeProjectCount: row.activeProjectCount,
        projects: row.projects.map((project) => ({
          projectId: String(project.projectId),
          projectName: project.projectName,
          allocationPercent: project.allocationPercent,
        })),
      },
    ])
  );
}

export async function getAllocationTotal(employeeId: string): Promise<AllocationTotal> {
  const map = await computeAllocationTotals([employeeId]);
  return (
    map.get(employeeId) ?? {
      employeeId,
      totalAllocation: 0,
      activeProjectCount: 0,
      projects: [],
    }
  );
}

/** Recomputes and persists the workload snapshot for one employee. */
export async function refreshWorkloadSnapshot(employeeId: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId)) {
    throw HttpError.badRequest("Invalid employee identifier.");
  }

  const [employee, totals] = await Promise.all([
    EmployeeModel.findById(employeeId)
      .select("availabilityPercent")
      .lean<Pick<EmployeeDoc, "availabilityPercent"> | null>(),
    getAllocationTotal(employeeId),
  ]);
  if (!employee) return;

  await WorkloadModel.findOneAndUpdate(
    { employeeId: new Types.ObjectId(employeeId) },
    {
      $set: {
        totalAllocation: totals.totalAllocation,
        utilizationBand: utilizationBand(totals.totalAllocation),
        activeProjectCount: totals.activeProjectCount,
        availabilityPercent: employee.availabilityPercent,
        projects: totals.projects.map((project) => ({
          projectId: new Types.ObjectId(project.projectId),
          projectName: project.projectName,
          allocationPercent: project.allocationPercent,
        })),
        computedAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

/** Refreshes every employee's workload snapshot. Returns the number processed. */
export async function recomputeAllWorkloads(): Promise<number> {
  await connectDB();

  const [employees, totals] = await Promise.all([
    EmployeeModel.find({}, { _id: 1, availabilityPercent: 1 }).lean(),
    computeAllocationTotals(),
  ]);

  const operations = employees.map((employee) => {
    const id = String(employee._id);
    const total = totals.get(id);
    const totalAllocation = total?.totalAllocation ?? 0;
    return {
      updateOne: {
        filter: { employeeId: employee._id },
        update: {
          $set: {
            totalAllocation,
            utilizationBand: utilizationBand(totalAllocation),
            activeProjectCount: total?.activeProjectCount ?? 0,
            availabilityPercent: employee.availabilityPercent,
            projects: (total?.projects ?? []).map((project) => ({
              projectId: new Types.ObjectId(project.projectId),
              projectName: project.projectName,
              allocationPercent: project.allocationPercent,
            })),
            computedAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await WorkloadModel.bulkWrite(operations, { ordered: false });
  }

  return employees.length;
}

export interface WorkloadRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
  jobRole: string;
  departmentId: string | null;
  departmentName: string | null;
  availabilityPercent: number;
  totalAllocation: number;
  utilizationBand: UtilizationBand;
  activeProjectCount: number;
  projects: Array<{ projectId: string; projectName: string; allocationPercent: number }>;
}

/**
 * The workload table is always computed live so it can never show stale numbers.
 */
export async function listWorkloadRows(params?: {
  band?: UtilizationBand;
  search?: string;
  departmentId?: string;
  jobRole?: string;
}): Promise<WorkloadRow[]> {
  await connectDB();

  const employeeFilter: Record<string, unknown> = {};
  if (params?.departmentId && Types.ObjectId.isValid(params.departmentId)) {
    employeeFilter.departmentId = new Types.ObjectId(params.departmentId);
  }
  if (params?.jobRole) employeeFilter.jobRole = params.jobRole;
  if (params?.search) {
    const { containsRegex } = await import("@/lib/db/query");
    const regex = containsRegex(params.search);
    employeeFilter.$or = [{ name: regex }, { email: regex }, { employeeId: regex }];
  }

  const employees = await EmployeeModel.find(employeeFilter)
    .populate<{ departmentId: { _id: Types.ObjectId; name: string } | null }>(
      "departmentId",
      "name"
    )
    .sort({ name: 1 })
    .lean();

  const totals = await computeAllocationTotals();

  const rows: WorkloadRow[] = employees.map((employee) => {
    const id = String(employee._id);
    const total = totals.get(id);
    const totalAllocation = total?.totalAllocation ?? 0;
    return {
      employeeId: id,
      employeeCode: employee.employeeId,
      employeeName: employee.name,
      email: employee.email,
      jobRole: employee.jobRole,
      departmentId: employee.departmentId ? String(employee.departmentId._id) : null,
      departmentName: employee.departmentId?.name ?? null,
      availabilityPercent: employee.availabilityPercent,
      totalAllocation,
      utilizationBand: utilizationBand(totalAllocation),
      activeProjectCount: total?.activeProjectCount ?? 0,
      projects: total?.projects ?? [],
    };
  });

  const filtered = params?.band
    ? rows.filter((row) => row.utilizationBand === params.band)
    : rows;
  return filtered.sort((a, b) => b.totalAllocation - a.totalAllocation);
}

/** Company-wide average utilization (capped per employee at 100%). */
export async function averageUtilization(): Promise<number> {
  const [totals, totalEmployees] = await Promise.all([
    computeAllocationTotals(),
    EmployeeModel.countDocuments({ status: "ACTIVE" }),
  ]);
  if (totalEmployees === 0) return 0;
  let sum = 0;
  for (const value of totals.values()) sum += Math.min(value.totalAllocation, 100);
  return Math.round((sum / totalEmployees) * 10) / 10;
}