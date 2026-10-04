import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact, resolveSort, searchFilter } from "@/lib/db/query";
import { nextEmployeeId } from "@/lib/db/sequence";
import { utilizationBand } from "@/lib/matching/engine";
import { EmployeeModel, type EmployeeDoc } from "@/models/Employee";
// Required for `.populate("departmentId")`: Mongoose needs the referenced
// model registered, otherwise it throws MissingSchemaError the first time this
// module is the only one loaded.
import { DepartmentModel } from "@/models/Department";
import { SkillModel } from "@/models/Skill";
import { computeAllocationTotals } from "@/services/workloadService";
import type { CreateEmployeeInput, SelfEmployeeUpdateInput, UpdateEmployeeInput } from "@/lib/validators/employee";
import type { EmployeeDTO, EmployeeSkillDTO, JobRole } from "@/types";
import type { EmployeeMatchInput } from "@/types/matching";

/**
 * Employee service — CRUD plus the mapping used by the matching engine.
 */

interface PopulatedDepartment {
  _id: Types.ObjectId;
  name: string;
}

type LeanEmployee = EmployeeDoc & {
  _id: Types.ObjectId;
  departmentId?: PopulatedDepartment | Types.ObjectId | null;
};

const SORTABLE = {
  name: "name",
  employeeId: "employeeId",
  yearsOfExperience: "yearsOfExperience",
  availabilityPercent: "availabilityPercent",
  createdAt: "createdAt",
} as const;

/** Accepts either a raw ObjectId or a populated department document. */
type PopulatedRef<T> = Types.ObjectId | (T & { _id: Types.ObjectId });

function departmentNameOf(value: PopulatedRef<{ name: string }> | null | undefined): {
  id: string | null;
  name: string | null;
} {
  if (!value) return { id: null, name: null };
  if (value instanceof Types.ObjectId) return { id: String(value), name: null };
  return { id: String(value._id), name: value.name };
}

/** Shape a lean employee document into a client-safe DTO. */
export function toEmployeeDTO(
  doc: LeanEmployee,
  skillMeta: Map<string, { name: string; category: EmployeeSkillDTO["category"] }>,
  workload: { totalAllocation: number; activeProjectCount: number } = {
    totalAllocation: 0,
    activeProjectCount: 0,
  }
): EmployeeDTO {
  const department = departmentNameOf(doc.departmentId);
  return {
    id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : null,
    employeeId: doc.employeeId,
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar ?? null,
    departmentId: department.id,
    departmentName: department.name,
    jobRole: doc.jobRole,
    status: doc.status,
    yearsOfExperience: doc.yearsOfExperience,
    location: doc.location,
    availabilityPercent: doc.availabilityPercent,
    calendarConnected:
      typeof doc.calendarAvailabilityPercent === "number" &&
      doc.calendarAvailabilityPercent !== null,
    skills: doc.skills.map((skill) => {
      const meta = skillMeta.get(String(skill.skillId));
      return {
        skillId: String(skill.skillId),
        skillName: meta?.name ?? "Unknown skill",
        category: meta?.category ?? "Programming",
        proficiency: skill.proficiency,
        yearsOfExperience: skill.yearsOfExperience,
      };
    }),
    certifications: doc.certifications.map((certification) => ({
      name: certification.name,
      issuer: certification.issuer ?? undefined,
      issuedOn: certification.issuedOn ? certification.issuedOn.toISOString() : null,
    })),
    totalAllocation: workload.totalAllocation,
    utilizationBand: utilizationBand(workload.totalAllocation),
    activeProjectCount: workload.activeProjectCount,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}

async function skillMetaMap(
  docs: Array<Pick<EmployeeDoc, "skills">>
): Promise<Map<string, { name: string; category: EmployeeSkillDTO["category"] }>> {
  const ids = new Set<string>();
  for (const doc of docs) {
    for (const skill of doc.skills ?? []) ids.add(String(skill.skillId));
  }
  if (ids.size === 0) return new Map();

  const skills = await SkillModel.find({ _id: { $in: [...ids] } }, { name: 1, category: 1 }).lean();
  return new Map(
    skills.map((skill) => [
      String(skill._id),
      { name: skill.name, category: skill.category },
    ])
  );
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface EmployeeListParams {
  q?: string;
  departmentId?: string;
  jobRole?: string;
  status?: string;
  skillId?: string;
  sort?: string;
  direction?: "asc" | "desc";
  skip?: number;
  pageSize?: number;
}

export async function listEmployees(
  params: EmployeeListParams = {}
): Promise<{ items: EmployeeDTO[]; total: number }> {
  await connectDB();

  const filter: FilterQuery<EmployeeDoc> = {
    ...searchFilter<EmployeeDoc>(params.q, ["name", "email", "employeeId", "location"]),
  };
  if (params.departmentId && Types.ObjectId.isValid(params.departmentId)) {
    filter.departmentId = new Types.ObjectId(params.departmentId);
  }
  if (params.jobRole) filter.jobRole = params.jobRole as JobRole;
  if (params.status) filter.status = params.status as EmployeeDoc["status"];
  if (params.skillId && Types.ObjectId.isValid(params.skillId)) {
    filter["skills.skillId"] = new Types.ObjectId(params.skillId);
  }

  const sort = resolveSort<EmployeeDoc>(
    params.sort,
    SORTABLE as unknown as Record<string, keyof EmployeeDoc & string>,
    "name",
    params.direction ?? "asc"
  );

  const [docs, total] = await Promise.all([
    EmployeeModel.find(filter)
      .populate("departmentId", "name")
      .sort(sort)
      .skip(params.skip ?? 0)
      .limit(params.pageSize ?? 200)
      .lean(),
    EmployeeModel.countDocuments(filter),
  ]);

  const [skillMeta, totals] = await Promise.all([
    skillMetaMap(docs),
    computeAllocationTotals(docs.map((doc) => String(doc._id))),
  ]);

  return {
    items: docs.map((doc) =>
      toEmployeeDTO(doc as LeanEmployee, skillMeta, totals.get(String(doc._id)))
    ),
    total,
  };
}

export async function getEmployeeById(id: string): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid employee identifier.");

  const doc = await EmployeeModel.findById(id).populate("departmentId", "name").lean();
  if (!doc) throw HttpError.notFound("That employee does not exist.");

  const lean = doc as LeanEmployee;
  const [skillMeta, totals] = await Promise.all([
    skillMetaMap([lean]),
    computeAllocationTotals([id]),
  ]);
  return toEmployeeDTO(lean, skillMeta, totals.get(id));
}

export async function getEmployeeByUserId(userId: string): Promise<EmployeeDTO | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) return null;

  const doc = await EmployeeModel.findOne({ userId: new Types.ObjectId(userId) })
    .populate("departmentId", "name")
    .lean();
  if (!doc) return null;

  const lean = doc as LeanEmployee;
  const [skillMeta, totals] = await Promise.all([
    skillMetaMap([lean]),
    computeAllocationTotals([String(doc._id)]),
  ]);
  return toEmployeeDTO(lean, skillMeta, totals.get(String(doc._id)));
}

/** Employees eligible to be allocated (used by the matching engine). */
export async function listEmployeesForMatching(params: {
  departmentId?: string;
  jobRole?: string;
  skillId?: string;
  statuses?: string[];
} = {}): Promise<EmployeeMatchInput[]> {
  await connectDB();

  const filter: FilterQuery<EmployeeDoc> = {
    status: { $in: (params.statuses ?? ["ACTIVE", "ON_LEAVE"]) as EmployeeDoc["status"][] },
  };
  if (params.departmentId && Types.ObjectId.isValid(params.departmentId)) {
    filter.departmentId = new Types.ObjectId(params.departmentId);
  }
  if (params.jobRole) filter.jobRole = params.jobRole as JobRole;
  if (params.skillId && Types.ObjectId.isValid(params.skillId)) {
    filter["skills.skillId"] = new Types.ObjectId(params.skillId);
  }

  const docs = await EmployeeModel.find(filter).lean();
  const [skillMeta, totals] = await Promise.all([
    skillMetaMap(docs),
    computeAllocationTotals(docs.map((doc) => String(doc._id))),
  ]);

  return docs.map((doc) => {
    const id = String(doc._id);
    return {
      employeeId: id,
      name: doc.name,
      jobRole: doc.jobRole,
      status: doc.status,
      yearsOfExperience: doc.yearsOfExperience,
      availabilityPercent: doc.availabilityPercent,
      calendarAvailabilityPercent: doc.calendarAvailabilityPercent ?? null,
      currentWorkloadPercent: totals.get(id)?.totalAllocation ?? 0,
      skills: doc.skills.map((skill) => {
        const meta = skillMeta.get(String(skill.skillId));
        return {
          skillId: String(skill.skillId),
          skillName: meta?.name ?? "Unknown skill",
          category: meta?.category ?? "Programming",
          proficiency: skill.proficiency,
          yearsOfExperience: skill.yearsOfExperience,
        };
      }),
    } satisfies EmployeeMatchInput;
  });
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

async function assertSkillsExist(skillIds: string[]): Promise<void> {
  if (skillIds.length === 0) return;
  const unique = [...new Set(skillIds)].filter((id) => Types.ObjectId.isValid(id));
  const found = await SkillModel.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) {
    throw HttpError.badRequest("One or more of the selected skills no longer exist.");
  }
}

function dedupeSkills(
  skills: Array<{ skillId: string; proficiency: number; yearsOfExperience: number }>
) {
  const map = new Map<
    string,
    { skillId: Types.ObjectId; proficiency: number; yearsOfExperience: number }
  >();
  for (const skill of skills) {
    if (!Types.ObjectId.isValid(skill.skillId)) continue;
    map.set(skill.skillId, {
      skillId: new Types.ObjectId(skill.skillId),
      proficiency: skill.proficiency,
      yearsOfExperience: skill.yearsOfExperience,
    });
  }
  return [...map.values()];
}

function mapCertifications(
  certifications: Array<{ name: string; issuer?: string | null; issuedOn?: Date | null }>
) {
  return certifications.map((certification) => ({
    name: certification.name,
    issuer: certification.issuer ?? undefined,
    issuedOn: certification.issuedOn ?? null,
  }));
}

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeDTO> {
  await connectDB();
  await assertSkillsExist(input.skills.map((skill) => skill.skillId));

  const employeeId = await nextEmployeeId();
  const doc = await EmployeeModel.create({
    userId:
      input.userId && Types.ObjectId.isValid(input.userId)
        ? new Types.ObjectId(input.userId)
        : null,
    employeeId,
    name: input.name,
    email: input.email,
    avatar: input.avatar ?? null,
    departmentId:
      input.departmentId && Types.ObjectId.isValid(input.departmentId)
        ? new Types.ObjectId(input.departmentId)
        : null,
    jobRole: input.jobRole,
    status: input.status,
    yearsOfExperience: input.yearsOfExperience,
    location: input.location,
    availabilityPercent: input.availabilityPercent,
    notes: input.notes ?? undefined,
    skills: dedupeSkills(input.skills),
    certifications: mapCertifications(input.certifications),
  });

  return getEmployeeById(String(doc._id));
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid employee identifier.");
  if (input.skills) await assertSkillsExist(input.skills.map((skill) => skill.skillId));

  const update: Record<string, unknown> = compact({
    name: input.name,
    email: input.email,
    avatar: input.avatar,
    jobRole: input.jobRole,
    status: input.status,
    yearsOfExperience: input.yearsOfExperience,
    location: input.location,
    availabilityPercent: input.availabilityPercent,
    notes: input.notes,
    employeeId: input.employeeId,
  });

  if (input.departmentId !== undefined) {
    update.departmentId =
      input.departmentId && Types.ObjectId.isValid(input.departmentId)
        ? new Types.ObjectId(input.departmentId)
        : null;
  }
  if (input.userId !== undefined) {
    update.userId =
      input.userId && Types.ObjectId.isValid(input.userId)
        ? new Types.ObjectId(input.userId)
        : null;
  }
  if (input.skills) update.skills = dedupeSkills(input.skills);
  if (input.certifications) update.certifications = mapCertifications(input.certifications);

  const doc = await EmployeeModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!doc) throw HttpError.notFound("That employee does not exist.");

  return getEmployeeById(id);
}

/** EMPLOYEE self-service update (a deliberately restricted field subset). */
export async function updateOwnProfile(
  employeeId: string,
  input: SelfEmployeeUpdateInput
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId)) {
    throw HttpError.badRequest("Invalid employee identifier.");
  }

  const update: Record<string, unknown> = compact({
    yearsOfExperience: input.yearsOfExperience,
    location: input.location,
    availabilityPercent: input.availabilityPercent,
  });
  if (input.certifications) update.certifications = mapCertifications(input.certifications);

  const doc = await EmployeeModel.findByIdAndUpdate(
    employeeId,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!doc) throw HttpError.notFound("That employee profile does not exist.");
  return getEmployeeById(employeeId);
}

export async function setAvailability(
  employeeId: string,
  availabilityPercent: number
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId)) {
    throw HttpError.badRequest("Invalid employee identifier.");
  }
  const doc = await EmployeeModel.findByIdAndUpdate(
    employeeId,
    { $set: { availabilityPercent } },
    { new: true, runValidators: true }
  );
  if (!doc) throw HttpError.notFound("That employee profile does not exist.");
  return getEmployeeById(employeeId);
}

/** Adds or updates a single skill on an employee profile. */
export async function upsertEmployeeSkill(
  employeeId: string,
  input: { skillId: string; proficiency: number; yearsOfExperience: number }
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId)) {
    throw HttpError.badRequest("Invalid employee identifier.");
  }
  await assertSkillsExist([input.skillId]);

  const employee = await EmployeeModel.findById(employeeId);
  if (!employee) throw HttpError.notFound("That employee does not exist.");

  const existing = employee.skills.find((skill) => String(skill.skillId) === input.skillId);
  if (existing) {
    existing.proficiency = input.proficiency;
    existing.yearsOfExperience = input.yearsOfExperience;
  } else {
    employee.skills.push({
      skillId: new Types.ObjectId(input.skillId),
      proficiency: input.proficiency,
      yearsOfExperience: input.yearsOfExperience,
    });
  }
  await employee.save();
  return getEmployeeById(employeeId);
}

export async function removeEmployeeSkill(
  employeeId: string,
  skillId: string
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId) || !Types.ObjectId.isValid(skillId)) {
    throw HttpError.badRequest("Invalid identifier.");
  }
  const employee = await EmployeeModel.findById(employeeId);
  if (!employee) throw HttpError.notFound("That employee does not exist.");

  employee.skills = employee.skills.filter((skill) => String(skill.skillId) !== skillId);
  await employee.save();
  return getEmployeeById(employeeId);
}

/** Replaces the whole skill set in one call (used by the profile editor). */
export async function setEmployeeSkills(
  employeeId: string,
  skills: Array<{ skillId: string; proficiency: number; yearsOfExperience: number }>
): Promise<EmployeeDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(employeeId)) {
    throw HttpError.badRequest("Invalid employee identifier.");
  }
  await assertSkillsExist(skills.map((skill) => skill.skillId));

  const doc = await EmployeeModel.findByIdAndUpdate(
    employeeId,
    { $set: { skills: dedupeSkills(skills) } },
    { new: true, runValidators: true }
  );
  if (!doc) throw HttpError.notFound("That employee does not exist.");
  return getEmployeeById(employeeId);
}

/**
 * Deleting an employee also removes their ACTIVE allocations so project staffing
 * numbers stay consistent. Employees who are still allocated cannot be deleted.
 */
export async function deleteEmployee(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid employee identifier.");

  const { AllocationModel } = await import("@/models/Allocation");
  const { WorkloadModel } = await import("@/models/Workload");

  const activeAllocations = await AllocationModel.countDocuments({
    employeeId: id,
    status: "ACTIVE",
  });
  if (activeAllocations > 0) {
    throw HttpError.conflict(
      `This employee is actively allocated to ${activeAllocations} project(s). Remove those allocations first.`
    );
  }

  const result = await EmployeeModel.findByIdAndDelete(id);
  if (!result) throw HttpError.notFound("That employee does not exist.");

  await Promise.all([
    AllocationModel.deleteMany({ employeeId: id }),
    WorkloadModel.deleteOne({ employeeId: id }),
  ]);
}

/** Number of employees per department, used by the dashboard charts. */
export async function employeesByDepartment(): Promise<Map<string, number>> {
  await connectDB();
  const rows = await EmployeeModel.aggregate<{ _id: Types.ObjectId | null; count: number }>([
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id ? String(row._id) : "unassigned", row.count]));
}

/** Skill distribution across the whole company (top N skills). */
export async function topSkills(limit = 10): Promise<Array<{ name: string; count: number }>> {
  await connectDB();
  const rows = await EmployeeModel.aggregate<{
    _id: Types.ObjectId;
    name: string;
    count: number;
  }>([
    { $unwind: "$skills" },
    { $group: { _id: "$skills.skillId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: { from: "skills", localField: "_id", foreignField: "_id", as: "skill" },
    },
    { $unwind: "$skill" },
    { $project: { name: "$skill.name", count: 1 } },
  ]);
  return rows.map((row) => ({ name: row.name, count: row.count }));
}

/** Match inputs for an explicit set of employee ids (used by team coverage). */
export async function getMatchInputsByIds(ids: string[]): Promise<EmployeeMatchInput[]> {
  await connectDB();
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  if (valid.length === 0) return [];

  const docs = await EmployeeModel.find({ _id: { $in: valid } }).lean();
  const [skillMeta, totals] = await Promise.all([
    skillMetaMap(docs),
    computeAllocationTotals(valid),
  ]);

  return docs.map((doc) => {
    const id = String(doc._id);
    return {
      employeeId: id,
      name: doc.name,
      jobRole: doc.jobRole,
      status: doc.status,
      yearsOfExperience: doc.yearsOfExperience,
      availabilityPercent: doc.availabilityPercent,
      calendarAvailabilityPercent: doc.calendarAvailabilityPercent ?? null,
      currentWorkloadPercent: totals.get(id)?.totalAllocation ?? 0,
      skills: doc.skills.map((skill) => {
        const meta = skillMeta.get(String(skill.skillId));
        return {
          skillId: String(skill.skillId),
          skillName: meta?.name ?? "Unknown skill",
          category: meta?.category ?? "Programming",
          proficiency: skill.proficiency,
          yearsOfExperience: skill.yearsOfExperience,
        };
      }),
    } satisfies EmployeeMatchInput;
  });
}