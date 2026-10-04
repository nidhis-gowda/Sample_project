import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { compact } from "@/lib/db/query";
import { NotificationModel, type NotificationDoc } from "@/models/Notification";
import type { NotificationDTO, NotificationType } from "@/types";

/**
 * Notification service.
 *
 * Notifications are always persisted in MongoDB and are only ever returned to
 * their owner — a user can never read another user's notifications.
 */

function toDTO(doc: NotificationDoc & { _id: Types.ObjectId }): NotificationDTO {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    link: doc.link ?? null,
    read: doc.read,
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
  };
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  meta?: Record<string, unknown>;
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationDTO> {
  await connectDB();
  const doc = await NotificationModel.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link ?? null,
    meta: input.meta ?? {},
    read: false,
  });
  return toDTO(doc.toObject() as NotificationDoc & { _id: Types.ObjectId });
}

export async function createManyNotifications(
  inputs: CreateNotificationInput[]
): Promise<number> {
  if (inputs.length === 0) return 0;
  await connectDB();
  const docs = await NotificationModel.insertMany(
    inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      meta: input.meta ?? {},
      read: false,
    }))
  );
  return docs.length;
}

export async function listNotifications(
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<NotificationDTO[]> {
  await connectDB();
  const docs = await NotificationModel.find({
    userId,
    ...(options?.unreadOnly ? { read: false } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(options?.limit ?? 50)
    .lean();
  return docs.map((doc) => toDTO(doc as NotificationDoc & { _id: Types.ObjectId }));
}

export async function unreadCount(userId: string): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ userId, read: false });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  await connectDB();
  const result = await NotificationModel.updateMany(
    { userId, read: false },
    { $set: compact({ read: true, readAt: new Date() }) }
  );
  return result.modifiedCount ?? 0;
}

export async function markReadSafe(userId: string, id: string): Promise<boolean> {
  await connectDB();
  const result = await NotificationModel.updateOne(
    { _id: id, userId },
    { $set: compact({ read: true, readAt: new Date() }) }
  );
  return (result.modifiedCount ?? 0) > 0;
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  await connectDB();
  await NotificationModel.deleteOne({ _id: id, userId });
}

/* ------------------------------------------------------------------ */
/* Domain specific helpers                                             */
/* ------------------------------------------------------------------ */

export async function notifyProjectAssignment(params: {
  employeeUserId: string | null;
  projectName: string;
  projectId: string;
  allocationPercent: number;
  roleInProject: string;
}): Promise<void> {
  if (!params.employeeUserId) return;
  await createNotification({
    userId: params.employeeUserId,
    type: "PROJECT_ASSIGNMENT",
    title: `You were allocated to ${params.projectName}`,
    message: `You have been assigned as ${params.roleInProject} on "${params.projectName}" with a ${params.allocationPercent}% allocation.`,
    link: `/projects/${params.projectId}`,
    meta: { projectId: params.projectId, allocationPercent: params.allocationPercent },
  });
}

export async function notifyAllocationApproval(params: {
  employeeUserId: string | null;
  projectName: string;
  projectId: string;
  approvedBy: string;
}): Promise<void> {
  if (!params.employeeUserId) return;
  await createNotification({
    userId: params.employeeUserId,
    type: "ALLOCATION_APPROVAL",
    title: `Allocation approved for ${params.projectName}`,
    message: `${params.approvedBy} confirmed your allocation on "${params.projectName}".`,
    link: `/projects/${params.projectId}`,
  });
}

export async function notifySkillGap(params: {
  managerUserId: string | null;
  projectName: string;
  projectId: string;
  missingSkills: string[];
}): Promise<void> {
  if (!params.managerUserId || params.missingSkills.length === 0) return;
  await createNotification({
    userId: params.managerUserId,
    type: "SKILL_GAP",
    title: `Skill gaps on ${params.projectName}`,
    message: `The current team does not fully cover: ${params.missingSkills.join(", ")}.`,
    link: `/skill-gaps?projectId=${params.projectId}`,
    meta: { projectId: params.projectId },
  });
}

export async function notifyTrainingRecommendation(params: {
  employeeUserId: string | null;
  skillName: string;
  targetLevel: number;
  trainingTitle: string;
  trainingId: string;
}): Promise<void> {
  if (!params.employeeUserId) return;
  await createNotification({
    userId: params.employeeUserId,
    type: "TRAINING_RECOMMENDATION",
    title: `Recommended training: ${params.trainingTitle}`,
    message: `To close your ${params.skillName} gap (target level ${params.targetLevel}/5) we recommend "${params.trainingTitle}".`,
    link: "/training",
    meta: { trainingId: params.trainingId, skillName: params.skillName },
  });
}

/**
 * Scans active projects with an approaching deadline and raises idempotent
 * notifications for the responsible manager.
 */
export async function scanDeadlineNotifications(withinDays = 14): Promise<number> {
  await connectDB();
  const { ProjectModel } = await import("@/models/Project");

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + withinDays);

  const projects = await ProjectModel.find({
    status: { $in: ["PLANNING", "ACTIVE"] },
    deadline: { $lte: threshold },
  })
    .select("name code deadline managerId")
    .lean();

  let created = 0;
  for (const project of projects) {
    if (!project.managerId) continue;

    const existing = await NotificationModel.findOne({
      userId: project.managerId,
      type: "DEADLINE_APPROACHING",
      "meta.projectId": String(project._id),
    }).lean();
    if (existing) continue;

    const days = Math.max(
      0,
      Math.ceil((project.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    await createNotification({
      userId: String(project.managerId),
      type: "DEADLINE_APPROACHING",
      title: `${project.name} is due in ${days} day(s)`,
      message: `Project ${project.code} ("${project.name}") has a deadline on ${project.deadline
        .toISOString()
        .slice(0, 10)}. Review staffing and progress.`,
      link: `/projects/${project._id}`,
      meta: { projectId: String(project._id), days },
    });
    created += 1;
  }
  return created;
}