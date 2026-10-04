import { Schema, model, models, type Model, type Types } from "mongoose";
import { NOTIFICATION_TYPES, type NotificationType } from "@/types";

export interface NotificationDoc {
  _id: Types.ObjectId;
  /** Recipient Auth.js user account. */
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  readAt?: Date | null;
  /** Free-form context (project id, allocation id, skill id ...). */
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES as unknown as string[],
      default: "SYSTEM",
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, default: null, maxlength: 300 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "notifications" }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const NotificationModel: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ||
  model<NotificationDoc>("Notification", notificationSchema);

export default NotificationModel;