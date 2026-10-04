import { Schema, model, models, type Model, type Types } from "mongoose";
import { USER_ROLES, type UserRole } from "@/types";

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
  googleId?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;

  /* ---- Google Calendar connection (never selected by default) ---- */
  googleRefreshToken?: string | null;
  googleAccessToken?: string | null;
  googleTokenExpiry?: Date | null;
  calendarConnected: boolean;
  calendarLastSyncedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const validation = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      validate: { validator: validation, message: "Invalid email address" },
    },
    image: { type: String, default: null },
    role: {
      type: String,
      enum: USER_ROLES as unknown as string[],
      default: "EMPLOYEE",
      required: true,
    },
    googleId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    googleRefreshToken: { type: String, default: null, select: false },
    googleAccessToken: { type: String, default: null, select: false },
    googleTokenExpiry: { type: Date, default: null, select: false },
    calendarConnected: { type: Boolean, default: false },
    calendarLastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
);

// Required index: email (also enforces one account per email address).
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);

export default UserModel;