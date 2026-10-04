import { Schema, model, models, type Model, type Types } from "mongoose";
import { UTILIZATION_BANDS, type UtilizationBand } from "@/types";

export interface WorkloadProjectSubdoc {
  projectId: Types.ObjectId;
  projectName: string;
  allocationPercent: number;
}

export interface WorkloadDoc {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  /** Sum of ACTIVE allocation percentages (may exceed 100). */
  totalAllocation: number;
  utilizationBand: UtilizationBand;
  activeProjectCount: number;
  availabilityPercent: number;
  projects: WorkloadProjectSubdoc[];
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const workloadProjectSchema = new Schema<WorkloadProjectSubdoc>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    projectName: { type: String, required: true, trim: true },
    allocationPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const workloadSchema = new Schema<WorkloadDoc>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, unique: true },
    totalAllocation: { type: Number, required: true, min: 0, default: 0 },
    utilizationBand: {
      type: String,
      required: true,
      enum: UTILIZATION_BANDS as unknown as string[],
      default: "AVAILABLE",
    },
    activeProjectCount: { type: Number, required: true, min: 0, default: 0 },
    availabilityPercent: { type: Number, min: 0, max: 100, default: 100 },
    projects: { type: [workloadProjectSchema], default: [] },
    computedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, collection: "workloads" }
);

workloadSchema.index({ utilizationBand: 1, totalAllocation: -1 });
workloadSchema.index({ totalAllocation: -1 });

export const WorkloadModel: Model<WorkloadDoc> =
  (models.Workload as Model<WorkloadDoc>) ||
  model<WorkloadDoc>("Workload", workloadSchema);

export default WorkloadModel;