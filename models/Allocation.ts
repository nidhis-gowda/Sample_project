import { Schema, model, models, type Model, type Types } from "mongoose";
import { ALLOCATION_STATUSES, type AllocationStatus } from "@/types";

export interface AllocationDoc {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  projectId: Types.ObjectId;
  /** Percentage of the employee's capacity dedicated to this project. */
  allocationPercent: number;
  roleInProject: string;
  startDate: Date;
  endDate?: Date | null;
  status: AllocationStatus;
  allocatedBy?: Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const allocationSchema = new Schema<AllocationDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    allocationPercent: { type: Number, required: true, min: 1, max: 100 },
    roleInProject: { type: String, required: true, trim: true, maxlength: 80 },
    startDate: { type: Date, required: true, default: () => new Date() },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: ALLOCATION_STATUSES as unknown as string[],
      default: "ACTIVE",
    },
    allocatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, maxlength: 600 },
  },
  { timestamps: true, collection: "allocations" }
);

allocationSchema.index({ employeeId: 1, status: 1 });
allocationSchema.index({ projectId: 1, status: 1 });
allocationSchema.index(
  { employeeId: 1, projectId: 1, status: 1 },
  { unique: false }
);

export const AllocationModel: Model<AllocationDoc> =
  (models.Allocation as Model<AllocationDoc>) ||
  model<AllocationDoc>("Allocation", allocationSchema);

export default AllocationModel;