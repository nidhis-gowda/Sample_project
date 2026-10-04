import { Types, type FilterQuery } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { compact, resolveSort, searchFilter } from "@/lib/db/query";
import { SkillModel } from "@/models/Skill";
import { TrainingModel, type TrainingDoc } from "@/models/Training";
import type { CreateTrainingInput } from "@/lib/validators/skill";
import type { TrainingLevel } from "@/types";

/** Internal training catalogue (no paid external API involved). */
export interface TrainingDTO {
  id: string;
  title: string;
  description: string;
  skillId: string | null;
  skillName: string;
  targetProficiency: number;
  level: TrainingLevel;
  provider: string;
  durationHours: number;
  url?: string | null;
  isInternal: boolean;
  tags: string[];
}

function toDTO(doc: TrainingDoc & { _id: Types.ObjectId }): TrainingDTO {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    skillId: doc.skillId ? String(doc.skillId) : null,
    skillName: doc.skillName,
    targetProficiency: doc.targetProficiency,
    level: doc.level,
    provider: doc.provider,
    durationHours: doc.durationHours,
    url: doc.url ?? null,
    isInternal: doc.isInternal,
    tags: doc.tags ?? [],
  };
}

export async function listTraining(params?: {
  q?: string;
  skillName?: string;
  level?: TrainingLevel;
  sort?: string;
  direction?: "asc" | "desc";
  limit?: number;
}): Promise<TrainingDTO[]> {
  await connectDB();

  const filter: FilterQuery<TrainingDoc> = {
    ...searchFilter<TrainingDoc>(params?.q, ["title", "description", "skillName"]),
  };
  if (params?.skillName) filter.skillName = params.skillName;
  if (params?.level) filter.level = params.level;

  const sort = resolveSort<TrainingDoc>(
    params?.sort,
    { title: "title", durationHours: "durationHours", level: "level" } as unknown as Record<
      string,
      keyof TrainingDoc & string
    >,
    "title",
    params?.direction ?? "asc"
  );

  const docs = await TrainingModel.find(filter).sort(sort).limit(params?.limit ?? 200).lean();
  return docs.map((doc) => toDTO(doc as TrainingDoc & { _id: Types.ObjectId }));
}

export async function createTraining(input: CreateTrainingInput): Promise<TrainingDTO> {
  await connectDB();
  const skillId =
    input.skillId && Types.ObjectId.isValid(input.skillId)
      ? new Types.ObjectId(input.skillId)
      : null;

  const doc = await TrainingModel.create({
    title: input.title,
    description: input.description,
    skillId,
    skillName: input.skillName,
    targetProficiency: input.targetProficiency,
    level: input.level,
    provider: input.provider,
    durationHours: input.durationHours,
    url: input.url ?? undefined,
    isInternal: input.isInternal,
    tags: input.tags,
  });
  return toDTO(doc.toObject() as TrainingDoc & { _id: Types.ObjectId });
}

export async function updateTraining(
  id: string,
  input: Partial<CreateTrainingInput>
): Promise<TrainingDTO> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid training identifier.");

  const update: Record<string, unknown> = compact({
    title: input.title,
    description: input.description,
    skillName: input.skillName,
    targetProficiency: input.targetProficiency,
    level: input.level,
    provider: input.provider,
    durationHours: input.durationHours,
    url: input.url,
    isInternal: input.isInternal,
    tags: input.tags,
  });
  if (input.skillId !== undefined) {
    update.skillId =
      input.skillId && Types.ObjectId.isValid(input.skillId)
        ? new Types.ObjectId(input.skillId)
        : null;
  }

  const doc = await TrainingModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) throw HttpError.notFound("That training course does not exist.");
  return toDTO(doc as TrainingDoc & { _id: Types.ObjectId });
}

export async function deleteTraining(id: string): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw HttpError.badRequest("Invalid training identifier.");
  const result = await TrainingModel.findByIdAndDelete(id);
  if (!result) throw HttpError.notFound("That training course does not exist.");
}

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

export interface TrainingGap {
  skillId: string | null;
  skillName: string;
  currentProficiency: number;
  requiredProficiency: number;
  reason: string;
  recommended: TrainingDTO | null;
}

/**
 * For each skill gap, find the most suitable internal course: same skill, target
 * level at least the requirement, smallest overshoot and shortest duration.
 */
export async function recommendTrainingForGaps(
  gaps: Array<{
    skillId?: string | null;
    skillName: string;
    currentProficiency: number;
    requiredProficiency: number;
    reason: string;
  }>
): Promise<TrainingGap[]> {
  await connectDB();
  if (gaps.length === 0) return [];

  const skillNames = [...new Set(gaps.map((gap) => gap.skillName))];
  const [courses, skillDocs] = await Promise.all([
    TrainingModel.find({ skillName: { $in: skillNames } }).lean(),
    SkillModel.find({ name: { $in: skillNames } }, { name: 1 }).lean(),
  ]);
  const skillIdByName = new Map(skillDocs.map((skill) => [skill.name, String(skill._id)]));

  return gaps.map((gap) => {
    const forSkill = courses.filter((course) => course.skillName === gap.skillName);
    const sufficient = forSkill
      .filter((course) => course.targetProficiency >= gap.requiredProficiency)
      .sort(
        (a, b) =>
          a.targetProficiency - b.targetProficiency || a.durationHours - b.durationHours
      );

    const best =
      sufficient[0] ??
      [...forSkill].sort((a, b) => b.targetProficiency - a.targetProficiency)[0];

    return {
      skillId: gap.skillId ?? skillIdByName.get(gap.skillName) ?? null,
      skillName: gap.skillName,
      currentProficiency: gap.currentProficiency,
      requiredProficiency: gap.requiredProficiency,
      reason: gap.reason,
      recommended: best ? toDTO(best as TrainingDoc & { _id: Types.ObjectId }) : null,
    };
  });
}