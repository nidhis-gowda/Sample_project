import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/rbac";
import { listNotifications, unreadCount } from "@/services/notificationService";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from "@/components/ui/Card";
import { formatTimeAgo } from "@/utils/format";
import { humanize } from "@/utils/format";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  PROJECT_ASSIGNMENT: "bg-brand-500",
  ALLOCATION_REQUEST: "bg-info",
  ALLOCATION_APPROVAL: "bg-success",
  SKILL_GAP: "bg-warning",
  TRAINING_RECOMMENDATION: "bg-brand-400",
  DEADLINE_APPROACHING: "bg-danger",
  SYSTEM: "bg-ink-400",
};

export default async function NotificationsPage() {
  const user = await requirePageUser("notification:read");

  const [items, unread] = await Promise.all([
    listNotifications(user.id, { limit: 100 }),
    unreadCount(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="section-title">Notifications</h1>
        <p className="section-subtitle">
          {unread > 0
            ? `${unread} unread of ${items.length} notification(s).`
            : "Everything has been read."}
        </p>
      </header>

      <Card>
        <CardHeader title="Your notifications" subtitle="Only you can see these" />
        {items.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            description="You are notified when you are allocated to a project, when a deadline approaches and when a training course is recommended."
          />
        ) : (
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {items.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        item.read ? "bg-ink-200" : (TONE[item.type] ?? "bg-brand-500")
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={
                            item.read
                              ? "text-sm text-ink-600"
                              : "text-sm font-semibold text-ink-900"
                          }
                        >
                          {item.title}
                        </p>
                        <Badge className="badge-neutral">
                          {humanize(item.type)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-600">
                        {item.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[11px] text-ink-400">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                        {item.link ? (
                          <a href={item.link} className="link text-xs">
                            Open
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        )}
      </Card>
    </div>
  );
}