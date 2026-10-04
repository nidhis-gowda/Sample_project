import { z } from "zod";
import { percentSchema, userRoleSchema } from "./common";

export const updateUserSchema = z.object({
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(2).max(160).optional(),
});

export const matchingWeightsSchema = z
  .object({
    skillMatch: z.coerce.number().min(0).max(1),
    experience: z.coerce.number().min(0).max(1),
    availability: z.coerce.number().min(0).max(1),
    workload: z.coerce.number().min(0).max(1),
    roleSuitability: z.coerce.number().min(0).max(1),
  })
  .refine(
    (weights) => {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      return Math.abs(sum - 1) < 0.001;
    },
    { message: "The matching weights must add up to 1.00 (100%)" }
  );

export const updateSettingsSchema = z.object({
  defaultNewUserRole: z.enum(["EMPLOYEE", "PROJECT_MANAGER"]).optional(),
  defaultAvailabilityPercent: percentSchema.optional(),
  maxWorkloadBeforeWarning: z.coerce.number().min(50).max(200).optional(),
  deadlineWarningDays: z.coerce.number().int().min(1).max(60).optional(),
  matchingWeights: matchingWeightsSchema.optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;