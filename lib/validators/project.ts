import { z } from "zod";
import {
  allocationStatusSchema,
  dateSchema,
  descriptionSchema,
  jobRoleSchema,
  nameSchema,
  objectIdSchema,
  optionalObjectIdSchema,
  percentSchema,
  proficiencySchema,
  projectPrioritySchema,
  projectStatusSchema,
  requirementImportanceSchema,
} from "./common";

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const projectRequirementSchema = z.object({
  skillId: z.string().trim().min(1, "Select a skill"),
  requiredProficiency: proficiencySchema,
  importance: requirementImportanceSchema.default("REQUIRED"),
});

export const createProjectSchema = z
  .object({
    name: nameSchema,
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Project code must be at least 2 characters")
      .max(24, "Project code must be at most 24 characters"),
    clientName: z.string().trim().min(2, "Client name is required").max(160),
    description: descriptionSchema,
    startDate: dateSchema,
    deadline: dateSchema,
    status: projectStatusSchema.default("PLANNING"),
    priority: projectPrioritySchema.default("MEDIUM"),
    requiredTeamSize: z.coerce.number().int().min(1, "At least one team member").max(200),
    requiredExperienceYears: z.coerce.number().min(0).max(30).default(3),
    progress: percentSchema.default(0),
    managerId: optionalObjectIdSchema,
    preferredRoles: z.array(jobRoleSchema).max(12).default([]),
    requirements: z.array(projectRequirementSchema).max(50).default([]),
  })
  .refine((data) => data.deadline.getTime() >= data.startDate.getTime(), {
    message: "The deadline must be on or after the start date",
    path: ["deadline"],
  });

export const updateProjectSchema = z
  .object({
    name: nameSchema.optional(),
    code: z.string().trim().toUpperCase().min(2).max(24).optional(),
    clientName: z.string().trim().min(2).max(160).optional(),
    description: descriptionSchema,
    startDate: dateSchema.optional(),
    deadline: dateSchema.optional(),
    status: projectStatusSchema.optional(),
    priority: projectPrioritySchema.optional(),
    requiredTeamSize: z.coerce.number().int().min(1).max(200).optional(),
    requiredExperienceYears: z.coerce.number().min(0).max(30).optional(),
    progress: percentSchema.optional(),
    managerId: optionalObjectIdSchema,
    preferredRoles: z.array(jobRoleSchema).max(12).optional(),
    requirements: z.array(projectRequirementSchema).max(50).optional(),
  })
  .refine(
    (data) =>
      !data.startDate || !data.deadline || data.deadline.getTime() >= data.startDate.getTime(),
    { message: "The deadline must be on or after the start date", path: ["deadline"] }
  );

/** Adding a single requirement to a project. */
export const projectRequirementBodySchema = z.object({
  skillId: objectIdSchema,
  requiredProficiency: proficiencySchema,
  importance: requirementImportanceSchema.default("REQUIRED"),
});

/* ------------------------------------------------------------------ */
/* Allocations                                                         */
/* ------------------------------------------------------------------ */

export const createAllocationSchema = z.object({
  employeeId: objectIdSchema,
  allocationPercent: z.coerce.number().min(1, "Minimum 1%").max(100, "Maximum 100%"),
  roleInProject: z.string().trim().min(2, "Role in project is required").max(80),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional().nullable(),
  notes: descriptionSchema,
  /** Allow the manager to override the overallocation warning. */
  allowOverallocated: z.boolean().default(false),
});

export const updateAllocationSchema = z.object({
  allocationPercent: z.coerce.number().min(1).max(100).optional(),
  roleInProject: z.string().trim().min(2).max(80).optional(),
  status: allocationStatusSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional().nullable(),
  notes: descriptionSchema,
  allowOverallocated: z.boolean().default(false),
});

export const allocateTeamSchema = z.object({
  members: z
    .array(
      z.object({
        employeeId: objectIdSchema,
        allocationPercent: z.coerce.number().min(1).max(100).default(50),
        roleInProject: z.string().trim().min(2).max(80).default("Contributor"),
      })
    )
    .min(1, "Select at least one employee")
    .max(50),
  allowOverallocated: z.boolean().default(false),
  startDate: dateSchema.optional(),
  notify: z.boolean().default(true),
});

/* ------------------------------------------------------------------ */
/* Recommendations                                                     */
/* ------------------------------------------------------------------ */

export const recommendationQuerySchema = z.object({
  minScore: z.coerce.number().min(0).max(100).optional(),
  departmentId: z.string().trim().optional(),
  jobRole: jobRoleSchema.optional(),
  skillId: z.string().trim().optional(),
  minAvailability: z.coerce.number().min(0).max(100).optional(),
  minExperience: z.coerce.number().min(0).max(60).optional(),
  maxWorkload: z.coerce.number().min(0).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  forceLocal: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectRequirementInput = z.infer<typeof projectRequirementSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type AllocateTeamInput = z.infer<typeof allocateTeamSchema>;
export type RecommendationQueryInput = z.infer<typeof recommendationQuerySchema>;