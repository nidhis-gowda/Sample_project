import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact, resolveSort, searchFilter } from "@/lib/db/query";
import { nextProjectCode } from "@/lib/db/sequence";
import { AllocationModel } from "@/models/Allocation";
import { ProjectModel, type ProjectDoc } from "@/models/Project";
import { SkillModel } from "@/models/Skill";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/validators/project";
import type { ProjectDTO, SkillCategory } from "@/types";
import type { ProjectMatchInput, SkillRequirementInput } from "@/types/matching";

/**
 * Project service — CRUD, skill requirements and the mapping used by the
 * matching engine.
 */

type LeanProject = ProjectDoc & {
  _id: Types.ObjectId;
  managerId?: Types.ObjectId | { _id: Types.ObjectId; name: string } | null;
};

interface StaffingInfo {
  allocatedCount: number;
  totalAllocationPercent: number;
}

/** Accepts either a raw ObjectId or a populated employee document. */
type PopulatedRef<T> = Types.ObjectId | (T & { _id: Types.ObjectId });

function managerOf(value: PopulatedRef<{ name: string }> | null | undefined): {
  id: string | null;
  name: string | null;
} {
  if (!value) return { id: null, name: null };
  if (value instanceof Types.ObjectId) return { id: String(value), name: null };
  return { id: String(value._id), name: value.name };
}

export function toProjectDTO(
  doc: LeanProject,
  requirementSkillMeta: Map<string, { name: string; category: SkillCategory }>,
  staffing: StaffingInfo = { allocatedCount: 0, totalAllocationPercent: 0 }
): ProjectDTO {
  const manager = managerOf(doc.managerId);
  const daysRemaining = Math.ceil((doc.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  // Staffing is measured in "people-equivalents": total allocated % / 100.
  const peopleEquivalent = staffing.totalAllocationPercent / 100;
  const staffingPercent =
    doc.requiredTeamSize > 0
      ? Math.min(200, Math.round((peopleEquivalent / doc.requiredTeamSize) * 100))
      : 0;

  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    clientName: doc.clientName,
    description: doc.description ?? undefined,
    startDate: doc.startDate.toISOString(),
    deadline: doc.deadline.toISOString(),
    status: doc.status,
    priority: doc.priority,
    requiredTeamSize: doc.requiredTeamSize,
    requiredExperienceYears: doc.requiredExperienceYears,
    progress: doc.progress,
    managerId: manager.id,
    managerName: manager.name,
    requirements: doc.requirements.map((requirement) => {
      const meta = requirementSkillMeta.get(String(requirement.skillId));
      return {
        id: String(requirement._id),
        skillId: String(requirement.skillId),
        skillName: meta?.name ?? "Unknown skill",
        category: meta?.category ?? "Programming",
        requiredProficiency: requirement.requiredProficiency,
        importance: requirement.importance,
      };
    }),
    allocatedCount: staffing.allocatedCount,
    totalAllocationPercent: staffing.totalAllocationPercent,
    daysRemaining,
    staffingPercent,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}

async function requirementSkillMeta(
  docs: Array<Pick<ProjectDoc, "requirements">>
): Promise<Map<string, { name: string; category: SkillCategory }>> {
  const ids = new Set<string>();
  for (const doc of docs) {
    for (const requirement of doc.requirements ?? []) ids.add(String(requirement.skillId));
  }
  if (ids.size === 0) return new Map();
  const skills = await SkillModel.find({ _id: { $in: [...ids] } }, { name: 1, category: 1 }).lean();
  return new Map(
    skills.map((skill) => [String(skill._id), { name: skill.name, category: skill.category }])
  );
}

/** Allocated people + summed allocation % per project. */
async function staffingByProject(projectIds: string[]): Promise<Map<string, StaffingInfo>> {
  if (projectIds.length === 0) return new Map();
  const rows = await AllocationModel.aggregate<{
    _id: Types.ObjectId;
    allocatedCount: number;
    totalAllocationPercent: number;
  }>([
    {
      $match: {
        status: "ACTIVE",
        projectId: {
          $in: projectIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id)),
        },
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

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        allocatedCount: Number(row.allocatedCount),
        totalAllocationPercent: Math.round(row.totalAllocationPercent * 10) / 10,
      },
    ])
  );
}

export async function getStaffing(projectId: string): Promise<StaffingInfo> {
  const map = await staffingByProject([projectId]);
  return map.get(projectId) ?? { allocatedCount: 0, totalAllocationPercent: 0 };
}

const SORTABLE = {
  name: "name",
  code: "code",
  deadline: "deadline",
  priority: "priority",
  createdAt: "createdAt",
  progress: "progress",
} as const;

export interface ProjectListParams {
  q?: string;
  status?: string;
  priority?: string;
  managerId?: string;
  skillId?: string;
  sort?: string;
  direction?: "asc" | "desc";
  skip?: number;
  pageSize?: number;
}

export async function listProjects(
  params: ProjectListParams = {}
): Promise<{ items: ProjectDTO[]; total: number }> {
  await connectDB();

  const filter: FilterQuery<ProjectDoc> = {
    ...searchFilter<ProjectDoc>(params.q, ["name", "code", "clientName", "description"]),
  };
  if (params.status) filter.status = params.status as ProjectDoc["status"];
  if (params.priority) filter.priority = params.priority as ProjectDoc["priority"];
  if (params.managerId && Types.ObjectId.isValid(params.managerId)) {
    filter.managerId = new Types.ObjectId(params.managerId);
  }
  if (params.skillId && Types.ObjectId.isValid(params.skillId)) {
    filter["requirements.skillId"] = new Types.ObjectId(params.skillId);
  }

  const sort = resolveSort<ProjectDoc>(
    params.sort,
    SORTABLE as unknown as Record<string, keyof ProjectDoc & string>,
    "createdAt",
    params.direction ?? "desc"
  );

  const [docs, total] = await Promise.all([
    ProjectModel.find(filter)
      .populate("managerId", "name")
      .sort(sort)
      .skip(params.skip ?? 0)
      .limit(params.pageSize ?? 200)
      .lean(),
    ProjectModel.countDocuments(filter),
  ]);

  const [meta, staffing] = await Promise.all([
    requirementSkillMeta(docs),
    staffingByProject(docs.map((doc) => String(doc._id))),
  ]);

  return {
    items: docs.map((doc) =>
      toProjectDTO(doc as LeanProject, meta, staffing.get(String(doc._id)))
    ),
    total,
  };
}

export async function getProjectById(id: string): Promise<ProjectDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid project identifier.");

  const doc = await ProjectModel.findById(id).populate("managerId", "name").lean();
  if (!doc) throw HttpError.notFound("That project does not exist.");

  const lean = doc as LeanProject;
  const [meta, staffing] = await Promise.all([
    requirementSkillMeta([lean]),
    staffingByProject([id]),
  ]);
  return toProjectDTO(lean, meta, staffing.get(id));
}

/** Mapping used by the matching engine. */
export async function getProjectMatchInput(id: string): Promise<ProjectMatchInput> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid project identifier.");

  const doc = await ProjectModel.findById(id).lean();
  if (!doc) throw HttpError.notFound("That project does not exist.");

  const meta = await requirementSkillMeta([doc]);
  const requirements: SkillRequirementInput[] = doc.requirements.map((requirement) => {
    const skillMeta = meta.get(String(requirement.skillId));
    return {
      skillId: String(requirement.skillId),
      skillName: skillMeta?.name ?? "Unknown skill",
      category: skillMeta?.category ?? "Programming",
      requiredProficiency: requirement.requiredProficiency,
      importance: requirement.importance,
    };
  });

  return {
    projectId: String(doc._id),
    name: doc.name,
    requiredTeamSize: doc.requiredTeamSize,
    requiredExperienceYears: doc.requiredExperienceYears,
    daysUntilDeadline: Math.ceil((doc.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    requirements,
  };
}

/** Projects that are approaching their deadline. */
export async function projectsApproachingDeadline(withinDays = 14): Promise<ProjectDTO[]> {
  await connectDB();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + withinDays);

  const docs = await ProjectModel.find({
    status: { $in: ["PLANNING", "ACTIVE"] },
    deadline: { $lte: threshold },
  })
    .populate("managerId", "name")
    .sort({ deadline: 1 })
    .limit(20)
    .lean();

  const meta = await requirementSkillMeta(docs);
  const staffing = await staffingByProject(docs.map((doc) => String(doc._id)));
  return docs.map((doc) =>
    toProjectDTO(doc as LeanProject, meta, staffing.get(String(doc._id)))
  );
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

async function assertRequirementSkills(requirements: Array<{ skillId: string }>): Promise<void> {
  if (requirements.length === 0) return;
  const ids = [...new Set(requirements.map((requirement) => requirement.skillId))].filter((id) =>
    Types.ObjectId.isValid(id)
  );
  const found = await SkillModel.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) {
    throw HttpError.badRequest("One or more of the required skills no longer exist.");
  }
}

function mapRequirements(
  requirements: Array<{ skillId: string; requiredProficiency: number; importance: string }>
) {
  return requirements
    .filter((requirement) => Types.ObjectId.isValid(requirement.skillId))
    .map((requirement) => ({
      skillId: new Types.ObjectId(requirement.skillId),
      requiredProficiency: requirement.requiredProficiency,
      importance: requirement.importance as "REQUIRED" | "OPTIONAL",
    }));
}

export async function createProject(
  input: CreateProjectInput,
  createdBy?: string | null
): Promise<ProjectDTO> {
  await connectDB();
  await assertRequirementSkills(input.requirements);

  const existing = await ProjectModel.findOne({ code: input.code.toUpperCase() }).lean();
  if (existing) {
    throw HttpError.conflict(
      `A project with the code "${input.code.toUpperCase()}" already exists.`
    );
  }

  const doc = await ProjectModel.create({
    name: input.name,
    code: input.code.toUpperCase(),
    clientName: input.clientName,
    description: input.description ?? undefined,
    startDate: input.startDate,
    deadline: input.deadline,
    status: input.status,
    priority: input.priority,
    requiredTeamSize: input.requiredTeamSize,
    requiredExperienceYears: input.requiredExperienceYears,
    progress: input.progress,
    managerId:
      input.managerId && Types.ObjectId.isValid(input.managerId)
        ? new Types.ObjectId(input.managerId)
        : createdBy && Types.ObjectId.isValid(createdBy)
          ? new Types.ObjectId(createdBy)
          : null,
    requirements: mapRequirements(input.requirements),
    createdBy:
      createdBy && Types.ObjectId.isValid(createdBy) ? new Types.ObjectId(createdBy) : null,
  });

  return getProjectById(String(doc._id));
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid project identifier.");
  if (input.requirements) await assertRequirementSkills(input.requirements);

  if (input.code) {
    const clash = await ProjectModel.findOne({
      code: input.code.toUpperCase(),
      _id: { $ne: id },
    }).lean();
    if (clash) {
      throw HttpError.conflict(
        `A project with the code "${input.code.toUpperCase()}" already exists.`
      );
    }
  }

  const update: Record<string, unknown> = compact({
    name: input.name,
    code: input.code ? input.code.toUpperCase() : undefined,
    clientName: input.clientName,
    description: input.description,
    startDate: input.startDate,
    deadline: input.deadline,
    status: input.status,
    priority: input.priority,
    requiredTeamSize: input.requiredTeamSize,
    requiredExperienceYears: input.requiredExperienceYears,
    progress: input.progress,
  });

  if (input.managerId !== undefined) {
    update.managerId =
      input.managerId && Types.ObjectId.isValid(input.managerId)
        ? new Types.ObjectId(input.managerId)
        : null;
  }
  if (input.requirements) update.requirements = mapRequirements(input.requirements);

  const doc = await ProjectModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!doc) throw HttpError.notFound("That project does not exist.");

  return getProjectById(id);
}

export async function deleteProject(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid project identifier.");

  const active = await AllocationModel.countDocuments({ projectId: id, status: "ACTIVE" });
  if (active > 0) {
    throw HttpError.conflict(
      `This project still has ${active} active allocation(s). Remove them before deleting the project.`
    );
  }

  const result = await ProjectModel.findByIdAndDelete(id);
  if (!result) throw HttpError.notFound("That project does not exist.");

  await AllocationModel.deleteMany({ projectId: id });
}

/** Adds (or updates) a single required skill on a project. */
export async function upsertRequirement(
  projectId: string,
  requirement: {
    skillId: string;
    requiredProficiency: number;
    importance: "REQUIRED" | "OPTIONAL";
  }
): Promise<ProjectDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId)) {
    throw HttpError.badRequest("Invalid project identifier.");
  }
  await assertRequirementSkills([requirement]);

  const project = await ProjectModel.findById(projectId);
  if (!project) throw HttpError.notFound("That project does not exist.");

  const existing = project.requirements.find(
    (entry) => String(entry.skillId) === requirement.skillId
  );
  if (existing) {
    existing.requiredProficiency = requirement.requiredProficiency;
    existing.importance = requirement.importance;
  } else {
    project.requirements.push({
      _id: new Types.ObjectId(),
      skillId: new Types.ObjectId(requirement.skillId),
      requiredProficiency: requirement.requiredProficiency,
      importance: requirement.importance,
    });
  }
  await project.save();
  return getProjectById(projectId);
}

export async function removeRequirement(
  projectId: string,
  skillId: string
): Promise<ProjectDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(projectId) || !Types.ObjectId.isValid(skillId)) {
    throw HttpError.badRequest("Invalid identifier.");
  }
  const project = await ProjectModel.findById(projectId);
  if (!project) throw HttpError.notFound("That project does not exist.");

  project.requirements = project.requirements.filter(
    (entry) => String(entry.skillId) !== skillId
  );
  await project.save();
  return getProjectById(projectId);
}

/** Project status distribution (dashboard chart). */
export async function projectsByStatus(): Promise<Map<string, number>> {
  await connectDB();
  const rows = await ProjectModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}