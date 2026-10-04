"use client";

import * as React from "react";
import Link from "next/link";
import { BellIcon, CheckIcon } from "@heroicons/react/24/outline";
import { api, errorMessage } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { formatTimeAgo } from "@/utils/format";
import type { NotificationDTO } from "@/types";
import { cn } from "@/utils/cn";

/** Notification bell and panel. Reads are always scoped to the signed-in user. */

const TONE: Record<string, string> = {
  PROJECT_ASSIGNMENT: "bg-brand-500",
  ALLOCATION_REQUEST: "bg-info",
  ALLOCATION_APPROVAL: "bg-success",
  SKILL_GAP: "bg-warning",
  TRAINING_RECOMMENDATION: "bg-brand-400",
  DEADLINE_APPROACHING: "bg-danger",
  SYSTEM: "bg-ink-400",
};

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationDTO[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const toast = useToast();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta } = await api.get<NotificationDTO[]>("/api/notifications?limit=15");
      setItems(data);
      setUnread(Number(meta?.unread ?? 0));
    } catch (error) {
      toast.error("Could not load notifications", errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Poll gently so a manager sees deadline alerts without a manual refresh.
  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const markAll = async () => {
    try {
      await api.post("/api/notifications/read-all");
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Could not update notifications", errorMessage(error));
    }
  };

  const markOne = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}`);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
      setUnread((value) => Math.max(0, value - 1));
    } catch (error) {
      toast.error("Could not update the notification", errorMessage(error));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop sm:w-96">
          <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">
              Notifications
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <CheckIcon className="h-3.5 w-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">Loading...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">
                You have no notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {items.map((item) => {
                  const body = (
                    <div className="flex gap-3 px-4 py-3">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          item.read ? "bg-ink-200" : (TONE[item.type] ?? "bg-brand-500")
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm leading-snug",
                            item.read ? "text-ink-600" : "font-semibold text-ink-900"
                          )}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-500">
                          {item.message}
                        </p>
                        <p className="mt-1 text-[11px] text-ink-400">
                          {formatTimeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={item.id} className={cn(!item.read && "bg-brand-50/40")}>
                      {item.link ? (
                        <Link
                          href={item.link}
                          onClick={() => {
                            setOpen(false);
                            if (!item.read) void markOne(item.id);
                          }}
                          className="block transition-colors hover:bg-ink-50"
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void markOne(item.id)}
                          className="block w-full text-left"
                        >
                          {body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-ink-200 bg-ink-50 px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}