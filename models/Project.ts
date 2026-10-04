import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  REQUIREMENT_IMPORTANCE,
  type ProjectPriority,
  type ProjectStatus,
  type RequirementImportance,
} from "@/types";

export interface ProjectRequirementSubdoc {
  _id: Types.ObjectId;
  skillId: Types.ObjectId;
  requiredProficiency: number;
  importance: RequirementImportance;
}

export interface ProjectDoc {
  _id: Types.ObjectId;
  name: string;
  code: string;
  clientName: string;
  description?: string;
  startDate: Date;
  deadline: Date;
  status: ProjectStatus;
  priority: ProjectPriority;
  requiredTeamSize: number;
  requiredExperienceYears: number;
  progress: number;
  /** Project manager — a User account with role PROJECT_MANAGER or ADMIN. */
  managerId?: Types.ObjectId | null;
  requirements: ProjectRequirementSubdoc[];
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<ProjectRequirementSubdoc>(
  {
    skillId: { type: Schema.Types.ObjectId, ref: "Skill", required: true },
    requiredProficiency: { type: Number, required: true, min: 1, max: 5 },
    importance: {
      type: String,
      required: true,
      enum: REQUIREMENT_IMPORTANCE as unknown as string[],
      default: "REQUIRED",
    },
  },
  { _id: true }
);

const projectSchema = new Schema<ProjectDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 24 },
    clientName: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000 },
    startDate: { type: Date, required: true },
    deadline: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: PROJECT_STATUSES as unknown as string[],
      default: "PLANNING",
    },
    priority: {
      type: String,
      required: true,
      enum: PROJECT_PRIORITIES as unknown as string[],
      default: "MEDIUM",
    },
    requiredTeamSize: { type: Number, required: true, min: 1, max: 200, default: 3 },
    requiredExperienceYears: { type: Number, required: true, min: 0, max: 30, default: 3 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    requirements: { type: [requirementSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "projects" }
);

// Required indexes.
projectSchema.index({ code: 1 }, { unique: true });
projectSchema.index({ status: 1, deadline: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ managerId: 1 });
projectSchema.index({ name: "text", clientName: "text", description: "text" });

export const ProjectModel: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) ||
  model<ProjectDoc>("Project", projectSchema);

export default ProjectModel;