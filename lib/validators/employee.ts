import { z } from "zod";
import {
  dateSchema,
  descriptionSchema,
  emailSchema,
  employeeStatusSchema,
  jobRoleSchema,
  nameSchema,
  optionalObjectIdSchema,
  percentSchema,
  proficiencySchema,
  yearsSchema,
} from "./common";

export const employeeSkillInputSchema = z.object({
  skillId: z.string().trim().min(1, "Select a skill"),
  proficiency: proficiencySchema,
  yearsOfExperience: yearsSchema.default(0),
});

export const certificationInputSchema = z.object({
  name: z.string().trim().min(2, "Certification name is required").max(160),
  issuer: z.string().trim().max(160).optional().nullable(),
  issuedOn: dateSchema.optional().nullable(),
});

export const createEmployeeSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  departmentId: optionalObjectIdSchema,
  jobRole: jobRoleSchema,
  status: employeeStatusSchema.default("ACTIVE"),
  yearsOfExperience: yearsSchema.default(0),
  location: z.string().trim().max(120).default("Remote"),
  availabilityPercent: percentSchema.default(100),
  avatar: z.string().trim().max(600).optional().nullable(),
  notes: descriptionSchema,
  skills: z.array(employeeSkillInputSchema).max(50).default([]),
  certifications: z.array(certificationInputSchema).max(30).default([]),
  /** Optionally link the employee profile to an existing Auth.js user. */
  userId: optionalObjectIdSchema,
});

/** Employees may update a *subset* of their own profile. */
export const selfEmployeeUpdateSchema = z.object({
  yearsOfExperience: yearsSchema.optional(),
  location: z.string().trim().max(120).optional(),
  availabilityPercent: percentSchema.optional(),
  certifications: z.array(certificationInputSchema).max(30).optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  employeeId: z.string().trim().max(24).optional(),
});

export const setEmployeeSkillsSchema = z.object({
  skills: z.array(employeeSkillInputSchema).max(50),
});

export const upsertEmployeeSkillSchema = z.object({
  skillId: z.string().trim().min(1, "Select a skill"),
  proficiency: proficiencySchema,
  yearsOfExperience: yearsSchema.default(0),
});

export const availabilitySchema = z.object({
  availabilityPercent: percentSchema,
  note: z.string().trim().max(300).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeSkillInput = z.infer<typeof employeeSkillInputSchema>;
export type CertificationInput = z.infer<typeof certificationInputSchema>;
export type SelfEmployeeUpdateInput = z.infer<typeof selfEmployeeUpdateSchema>;