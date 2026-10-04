import { connectDB } from "@/lib/db/connect";
import { compact } from "@/lib/db/query";
import { SettingsModel, type SettingsDoc } from "@/models/Settings";
import type { UpdateSettingsInput } from "@/lib/validators/admin";

/**
 * Singleton application settings document (`key: "global"`).
 * The matching weights stored here are informational metadata exposed in the
 * admin UI; the engine itself always uses the documented 45/15/15/15/10 split
 * unless explicitly overridden programmatically.
 */

export interface SettingsDTO {
  defaultNewUserRole: SettingsDoc["defaultNewUserRole"];
  defaultAvailabilityPercent: number;
  maxWorkloadBeforeWarning: number;
  deadlineWarningDays: number;
  matchingWeights: SettingsDoc["matchingWeights"];
  updatedAt?: string;
}

const DEFAULTS: Omit<SettingsDoc, "_id" | "createdAt" | "updatedAt" | "key"> = {
  defaultRole: "EMPLOYEE",
  defaultAvailabilityPercent: 100,
  defaultNewUserRole: "EMPLOYEE",
  maxWorkloadBeforeWarning: 90,
  deadlineWarningDays: 14,
  matchingWeights: {
    skillMatch: 0.45,
    experience: 0.15,
    availability: 0.15,
    workload: 0.15,
    roleSuitability: 0.1,
  },
};

function toDTO(doc: SettingsDoc & { updatedAt?: Date }): SettingsDTO {
  return {
    defaultNewUserRole: doc.defaultNewUserRole,
    defaultAvailabilityPercent: doc.defaultAvailabilityPercent,
    maxWorkloadBeforeWarning: doc.maxWorkloadBeforeWarning,
    deadlineWarningDays: doc.deadlineWarningDays,
    matchingWeights: doc.matchingWeights,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}

export async function getSettings(): Promise<SettingsDTO> {
  await connectDB();
  const doc = await SettingsModel.findOneAndUpdate(
    { key: "global" },
    { $setOnInsert: { key: "global", ...DEFAULTS } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return toDTO(doc as SettingsDoc & { updatedAt?: Date });
}

export async function updateSettings(input: UpdateSettingsInput): Promise<SettingsDTO> {
  await connectDB();
  const doc = await SettingsModel.findOneAndUpdate(
    { key: "global" },
    { $set: compact(input), $setOnInsert: { key: "global" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return toDTO(doc as SettingsDoc & { updatedAt?: Date });
}