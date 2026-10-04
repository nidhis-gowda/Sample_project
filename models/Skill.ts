import { Schema, model, models, type Model, type Types } from "mongoose";
import { SKILL_CATEGORIES, type SkillCategory } from "@/types";

export interface SkillDoc {
  _id: Types.ObjectId;
  name: string;
  /** Normalised lower-case name used for case-insensitive uniqueness. */
  slug: string;
  category: SkillCategory;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const skillSchema = new Schema<SkillDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    category: {
      type: String,
      required: true,
      enum: SKILL_CATEGORIES as unknown as string[],
      default: "Programming",
    },
    description: { type: String, trim: true, maxlength: 600 },
  },
  { timestamps: true, collection: "skills" }
);

// Required index: skill name (via normalised slug) must be unique.
skillSchema.index({ slug: 1 }, { unique: true });
skillSchema.index({ category: 1, name: 1 });
skillSchema.index({ name: "text", description: "text" });

skillSchema.pre("validate", function (next) {
  if (this.name) this.slug = this.name.trim().toLowerCase();
  next();
});

export const SkillModel: Model<SkillDoc> =
  (models.Skill as Model<SkillDoc>) || model<SkillDoc>("Skill", skillSchema);

export default SkillModel;