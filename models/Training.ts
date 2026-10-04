import { Schema, model, models, type Model, type Types } from "mongoose";
import { TRAINING_LEVELS, type TrainingLevel } from "@/types";

export interface TrainingDoc {
  _id: Types.ObjectId;
  title: string;
  description: string;
  /** Skill this training closes the gap for. */
  skillId: Types.ObjectId | null;
  skillName: string;
  /** Proficiency level the trainee reaches after completing the course. */
  targetProficiency: number;
  level: TrainingLevel;
  provider: string;
  durationHours: number;
  url?: string;
  isInternal: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const trainingSchema = new Schema<TrainingDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 1200 },
    skillId: { type: Schema.Types.ObjectId, ref: "Skill", default: null, index: true },
    skillName: { type: String, required: true, trim: true, maxlength: 80 },
    targetProficiency: { type: Number, required: true, min: 1, max: 5 },
    level: {
      type: String,
      enum: TRAINING_LEVELS as unknown as string[],
      default: "INTERMEDIATE",
      index: true,
    },
    provider: { type: String, trim: true, default: "Internal Academy", maxlength: 120 },
    durationHours: { type: Number, min: 0, max: 500, default: 8 },
    url: { type: String, trim: true, maxlength: 500 },
    isInternal: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, collection: "training" }
);

trainingSchema.index({ skillName: 1, targetProficiency: 1 });
trainingSchema.index({ title: "text", description: "text" });

export const TrainingModel: Model<TrainingDoc> =
  (models.Training as Model<TrainingDoc>) ||
  model<TrainingDoc>("Training", trainingSchema);

export default TrainingModel;