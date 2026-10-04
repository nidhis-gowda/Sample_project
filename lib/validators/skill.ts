import { z } from "zod";
import { descriptionSchema, nameSchema, skillCategorySchema } from "./common";

export const createSkillSchema = z.object({
  name: nameSchema.max(80, "Skill name must be at most 80 characters"),
  category: skillCategorySchema,
  description: descriptionSchema,
});

export const updateSkillSchema = createSkillSchema.partial();

export const createDepartmentSchema = z.object({
  name: nameSchema,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code must be at least 2 characters")
    .max(12, "Code must be at most 12 characters"),
  description: descriptionSchema,
  location: z.string().trim().max(120).optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createTrainingSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(160),
  description: z.string().trim().min(10, "Description is required").max(1200),
  skillId: z.string().trim().optional().nullable(),
  skillName: z.string().trim().min(1, "Skill name is required").max(80),
  targetProficiency: z.coerce.number().int().min(1).max(5),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("INTERMEDIATE"),
  provider: z.string().trim().max(120).default("Internal Academy"),
  durationHours: z.coerce.number().min(0).max(500).default(8),
  url: z.string().trim().max(500).optional().nullable(),
  isInternal: z.boolean().default(true),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
});

export const updateTrainingSchema = createTrainingSchema.partial();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;