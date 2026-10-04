import { z } from "zod";
import {
  ALLOCATION_STATUSES,
  EMPLOYEE_STATUSES,
  JOB_ROLES,
  NOTIFICATION_TYPES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  REQUIREMENT_IMPORTANCE,
  SKILL_CATEGORIES,
  TRAINING_LEVELS,
  USER_ROLES,
} from "@/types";

/** A MongoDB ObjectId as a 24 character hex string. */
export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, "Enter a valid identifier");

export const optionalObjectIdSchema = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Email is required")
  .max(200, "Email is too long")
  .email("Enter a valid email address");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(160, "Must be at most 160 characters");

export const descriptionSchema = z
  .string()
  .trim()
  .max(3000, "Description is too long")
  .optional()
  .nullable();

export const dateSchema = z.coerce.date({ errorMap: () => ({ message: "Enter a valid date" }) });

export const proficiencySchema = z.coerce
  .number()
  .int("Proficiency must be a whole number")
  .min(1, "Minimum proficiency is 1 (Beginner)")
  .max(5, "Maximum proficiency is 5 (Expert)");

export const yearsSchema = z.coerce
  .number()
  .min(0, "Cannot be negative")
  .max(60, "Cannot exceed 60 years");

export const percentSchema = z.coerce
  .number()
  .min(0, "Cannot be negative")
  .max(100, "Cannot exceed 100%");

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleSchema = z.enum(USER_ROLES);
export const skillCategorySchema = z.enum(SKILL_CATEGORIES);
export const jobRoleSchema = z.enum(JOB_ROLES);
export const employeeStatusSchema = z.enum(EMPLOYEE_STATUSES);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const projectPrioritySchema = z.enum(PROJECT_PRIORITIES);
export const requirementImportanceSchema = z.enum(REQUIREMENT_IMPORTANCE);
export const allocationStatusSchema = z.enum(ALLOCATION_STATUSES);
export const trainingLevelSchema = z.enum(TRAINING_LEVELS);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/* ------------------------------------------------------------------ */
/* Shared list query helpers                                           */
/* ------------------------------------------------------------------ */

export const sortDirectionSchema = z.enum(["asc", "desc"]).default("desc");

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(200).catch(20),
  q: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(60).optional(),
  direction: sortDirectionSchema,
});

export type ListQuery = z.infer<typeof listQuerySchema>;