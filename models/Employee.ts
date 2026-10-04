import { Schema, model, models, type Model, type Types } from "mongoose";
import { EMPLOYEE_STATUSES, JOB_ROLES, type EmployeeStatus, type JobRole } from "@/types";

export interface EmployeeSkillSubdoc {
  skillId: Types.ObjectId;
  proficiency: number;
  yearsOfExperience: number;
}

export interface CertificationSubdoc {
  name: string;
  issuer?: string;
  issuedOn?: Date | null;
}

export interface EmployeeDoc {
  _id: Types.ObjectId;
  /** Linked Auth.js user account (optional so employees can be pre-seeded). */
  userId?: Types.ObjectId | null;
  employeeId: string;
  name: string;
  email: string;
  avatar?: string | null;
  departmentId?: Types.ObjectId | null;
  jobRole: JobRole;
  status: EmployeeStatus;
  yearsOfExperience: number;
  location: string;
  /** Manually declared weekly availability, 0-100. */
  availabilityPercent: number;
  /** Availability derived from Google Calendar (null when not connected). */
  calendarAvailabilityPercent?: number | null;
  skills: EmployeeSkillSubdoc[];
  certifications: CertificationSubdoc[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const skillRefSchema = new Schema<EmployeeSkillSubdoc>(
  {
    skillId: { type: Schema.Types.ObjectId, ref: "Skill", required: true },
    proficiency: { type: Number, required: true, min: 1, max: 5 },
    yearsOfExperience: { type: Number, required: true, min: 0, max: 60, default: 0 },
  },
  { _id: false }
);

const certificationSchema = new Schema<CertificationSubdoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    issuer: { type: String, trim: true, maxlength: 160 },
    issuedOn: { type: Date, default: null },
  },
  { _id: false }
);

const employeeSchema = new Schema<EmployeeDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    employeeId: { type: String, required: true, trim: true, uppercase: true, maxlength: 24 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatar: { type: String, default: null },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    jobRole: {
      type: String,
      required: true,
      enum: JOB_ROLES as unknown as string[],
      default: "BACKEND_DEVELOPER",
    },
    status: {
      type: String,
      required: true,
      enum: EMPLOYEE_STATUSES as unknown as string[],
      default: "ACTIVE",
    },
    yearsOfExperience: { type: Number, required: true, min: 0, max: 60, default: 0 },
    location: { type: String, trim: true, default: "Remote", maxlength: 120 },
    availabilityPercent: { type: Number, required: true, min: 0, max: 100, default: 100 },
    calendarAvailabilityPercent: { type: Number, default: null, min: 0, max: 100 },
    skills: { type: [skillRefSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 1200 },
  },
  { timestamps: true, collection: "employees" }
);

// Required indexes.
employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ email: 1 }, { unique: true });
employeeSchema.index({ userId: 1 }, { sparse: true });
employeeSchema.index({ departmentId: 1 });
employeeSchema.index({ jobRole: 1, status: 1 });
employeeSchema.index({ "skills.skillId": 1 });
employeeSchema.index({ name: "text", email: "text", location: "text" });

export const EmployeeModel: Model<EmployeeDoc> =
  (models.Employee as Model<EmployeeDoc>) ||
  model<EmployeeDoc>("Employee", employeeSchema);

export default EmployeeModel;