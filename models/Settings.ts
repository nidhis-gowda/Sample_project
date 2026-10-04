import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Application wide settings. A single document identified by `key: "global"`.
 */
export interface SettingsDoc {
  _id: Types.ObjectId;
  key: string;
  defaultRole: "ADMIN" | "PROJECT_MANAGER" | "EMPLOYEE";
  defaultAvailabilityPercent: number;
  defaultNewUserRole: "EMPLOYEE" | "PROJECT_MANAGER";
  maxWorkloadBeforeWarning: number;
  deadlineWarningDays: number;
  matchingWeights: {
    skillMatch: number;
    experience: number;
    availability: number;
    workload: number;
    roleSuitability: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    defaultRole: {
      type: String,
      enum: ["ADMIN", "PROJECT_MANAGER", "EMPLOYEE"],
      default: "EMPLOYEE",
    },
    defaultAvailabilityPercent: { type: Number, min: 0, max: 100, default: 100 },
    defaultNewUserRole: {
      type: String,
      enum: ["EMPLOYEE", "PROJECT_MANAGER"],
      default: "EMPLOYEE",
    },
    maxWorkloadBeforeWarning: { type: Number, min: 50, max: 200, default: 90 },
    deadlineWarningDays: { type: Number, min: 1, max: 60, default: 14 },
    matchingWeights: {
      skillMatch: { type: Number, default: 0.45 },
      experience: { type: Number, default: 0.15 },
      availability: { type: Number, default: 0.15 },
      workload: { type: Number, default: 0.15 },
      roleSuitability: { type: Number, default: 0.1 },
    },
  },
  { timestamps: true, collection: "settings" }
);

export const SettingsModel: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ||
  model<SettingsDoc>("Settings", settingsSchema);

export default SettingsModel;