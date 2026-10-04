import { Schema, model, models, type Model, type Types } from "mongoose";

export interface DepartmentDoc {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 12 },
    description: { type: String, trim: true, maxlength: 600 },
    location: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true, collection: "departments" }
);

// Unique index already implies an index on the field itself.
departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ code: 1 }, { unique: true });

export const DepartmentModel: Model<DepartmentDoc> =
  (models.Department as Model<DepartmentDoc>) ||
  model<DepartmentDoc>("Department", departmentSchema);

export default DepartmentModel;