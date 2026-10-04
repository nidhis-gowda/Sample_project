import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact, resolveSort, searchFilter } from "@/lib/db/query";
import { EmployeeModel } from "@/models/Employee";
import { SkillModel, type SkillDoc } from "@/models/Skill";
import type { CreateSkillInput, UpdateSkillInput } from "@/lib/validators/skill";
import type { SkillCategory, SkillDTO } from "@/types";

/**
 * Skill catalogue service. Skills are referenced (never duplicated) by employees
 * and projects through their ObjectId.
 */

export interface SkillWithUsage extends SkillDTO {
  employeeCount: number;
  createdAt?: string;
}

const SORTABLE = {
  name: "name",
  category: "category",
  createdAt: "createdAt",
} as const;

function toDTO(doc: SkillDoc & { _id: Types.ObjectId }, employeeCount = 0): SkillWithUsage {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    description: doc.description ?? undefined,
    employeeCount,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
  };
}

async function usageCounts(): Promise<Map<string, number>> {
  const rows = await EmployeeModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $unwind: "$skills" },
    { $group: { _id: "$skills.skillId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function listSkills(params: {
  q?: string;
  category?: SkillCategory;
  sort?: string;
  direction?: "asc" | "desc";
  skip?: number;
  pageSize?: number;
}): Promise<{ items: SkillWithUsage[]; total: number }> {
  await connectDB();

  const filter: FilterQuery<SkillDoc> = {
    ...searchFilter<SkillDoc>(params.q, ["name", "description"]),
    ...(params.category ? { category: params.category } : {}),
  };

  const sort = resolveSort<SkillDoc>(
    params.sort,
    SORTABLE as unknown as Record<string, keyof SkillDoc & string>,
    "name",
    params.direction ?? "asc"
  );

  const [docs, total, counts] = await Promise.all([
    SkillModel.find(filter)
      .sort(sort)
      .skip(params.skip ?? 0)
      .limit(params.pageSize ?? 200)
      .lean(),
    SkillModel.countDocuments(filter),
    usageCounts(),
  ]);

  return {
    items: docs.map((doc) => toDTO(doc as SkillDoc & { _id: Types.ObjectId }, counts.get(String(doc._id)) ?? 0)),
    total,
  };
}

export async function getSkillById(id: string): Promise<SkillWithUsage> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid skill identifier.");
  const doc = await SkillModel.findById(id).lean();
  if (!doc) throw HttpError.notFound("That skill does not exist.");
  const counts = await usageCounts();
  return toDTO(doc as SkillDoc & { _id: Types.ObjectId }, counts.get(String(doc._id)) ?? 0);
}

export async function getSkillsByIds(ids: string[]): Promise<SkillDTO[]> {
  if (ids.length === 0) return [];
  await connectDB();
  const docs = await SkillModel.find({
    _id: { $in: ids.filter((id) => Types.ObjectId.isValid(id)) },
  })
    .sort({ name: 1 })
    .lean();
  return docs.map((doc) => toDTO(doc as SkillDoc & { _id: Types.ObjectId }));
}

export async function createSkill(input: CreateSkillInput): Promise<SkillWithUsage> {
  await connectDB();
  const existing = await SkillModel.findOne({ slug: input.name.trim().toLowerCase() }).lean();
  if (existing) throw HttpError.conflict(`The skill "${input.name}" already exists.`);

  const doc = await SkillModel.create({
    name: input.name,
    category: input.category,
    description: input.description ?? undefined,
  });
  return toDTO(doc.toObject() as SkillDoc & { _id: Types.ObjectId });
}

export async function updateSkill(id: string, input: UpdateSkillInput): Promise<SkillWithUsage> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid skill identifier.");

  if (input.name) {
    const clash = await SkillModel.findOne({
      slug: input.name.trim().toLowerCase(),
      _id: { $ne: id },
    }).lean();
    if (clash) throw HttpError.conflict(`The skill "${input.name}" already exists.`);
  }

  const doc = await SkillModel.findByIdAndUpdate(
    id,
    { $set: compact(input) },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) throw HttpError.notFound("That skill does not exist.");
  return toDTO(doc as SkillDoc & { _id: Types.ObjectId });
}

/**
 * Deleting a skill that is still referenced would silently corrupt employee and
 * project requirements, so the deletion is rejected with a helpful message.
 */
export async function deleteSkill(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid skill identifier.");

  const [employeeUsage, projectUsage] = await Promise.all([
    EmployeeModel.countDocuments({ "skills.skillId": id }),
    (await import("@/models/Project")).ProjectModel.countDocuments({ "requirements.skillId": id }),
  ]);

  if (employeeUsage > 0 || projectUsage > 0) {
    throw HttpError.conflict(
      `This skill is used by ${employeeUsage} employee profile(s) and ${projectUsage} project requirement(s). Remove those references first.`
    );
  }

  const result = await SkillModel.findByIdAndDelete(id);
  if (!result) throw HttpError.notFound("That skill does not exist.");
}

/** Categories with the number of skills in each (used by the dashboard). */
export async function skillsByCategory(): Promise<Map<string, number>> {
  await connectDB();
  const rows = await SkillModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}