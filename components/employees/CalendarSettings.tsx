"use client";

import * as React from "react";
import { CalendarDaysIcon, LinkIcon } from "@heroicons/react/24/outline";
import { api, errorMessage } from "@/hooks/useApi";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/hooks/useToast";
import { Badge, Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/Card";
import { formatDateTime, formatPercent, humanize } from "@/utils/format";

/**
 * Optional Google Calendar connection.
 *
 * Only busy/free time is read. Event titles, attendees and descriptions are never
 * fetched or stored, and other users only ever see the derived percentage.
 */

interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  calendarAvailabilityPercent: number | null;
  manualAvailabilityPercent: number;
  note: string;
}

export function CalendarSettings() {
  const toast = useToast();
  const [busy, setBusy] = React.useState<"sync" | "disconnect" | null>(null);
  const { data, loading, reload } = useApiData<CalendarStatus>("/api/calendar/status");

  const sync = async () => {
    setBusy("sync");
    try {
      const { data: result } = await api.post<CalendarStatus>("/api/calendar/sync");
      toast.success(
        "Availability refreshed",
        result.calendarAvailabilityPercent !== null
          ? `Calendar free time: ${result.calendarAvailabilityPercent}%`
          : undefined
      );
      reload();
    } catch (cause) {
      toast.error("Calendar sync failed", errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try {
      await api.delete("/api/calendar/sync");
      toast.success("Calendar disconnected", "Your manual availability is being used.");
      reload();
    } catch (cause) {
      toast.error("Could not disconnect the calendar", errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Google Calendar"
        subtitle="Optional. Refines your availability score using free/busy time only."
      />
      <CardBody className="space-y-4">
        {loading && !data ? (
          <p className="text-sm text-ink-500">Checking the calendar connection...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {!data?.configured ? (
                <Badge className="badge-warning">Not configured</Badge>
              ) : data.connected ? (
                <Badge className="badge-success">Connected</Badge>
              ) : (
                <Badge className="badge-neutral">Not connected</Badge>
              )}
              {data?.lastSyncedAt ? (
                <span className="text-xs text-ink-500">
                  Last synced {formatDateTime(data.lastSyncedAt)}
                </span>
              ) : null}
            </div>

            <p className="text-sm leading-relaxed text-ink-600">{data?.note}</p>

            {data?.calendarAvailabilityPercent !== null &&
            data?.calendarAvailabilityPercent !== undefined ? (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-600">Calendar-derived availability</span>
                  <span className="font-semibold tabular-nums text-ink-900">
                    {formatPercent(data.calendarAvailabilityPercent)}
                  </span>
                </div>
                <ProgressBar
                  value={data.calendarAvailabilityPercent}
                  colorClass="bg-info"
                  className="mt-1.5"
                  label="Calendar availability"
                />
              </div>
            ) : null}

            <p className="rounded-lg bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
              <strong className="font-semibold text-ink-800">Privacy:</strong> only busy
              periods in the next 14 days are read. Event titles, attendees and
              descriptions are never accessed or stored, and other employees only ever
              see the derived availability percentage - never your calendar itself.
            </p>

            <div className="flex flex-wrap gap-2">
              {!data?.configured ? (
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <LinkIcon className="h-4 w-4" aria-hidden />
                  Configure Google OAuth
                </a>
              ) : data.connected ? (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={sync}
                    disabled={busy !== null}
                  >
                    <CalendarDaysIcon className="h-4 w-4" aria-hidden />
                    {busy === "sync" ? "Syncing..." : "Refresh availability"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={disconnect}
                    disabled={busy !== null}
                  >
                    {busy === "disconnect" ? "Disconnecting..." : "Disconnect"}
                  </button>
                </>
              ) : (
                <p className="text-xs text-ink-500">
                  Sign out and back in with Google, granting calendar access, to connect
                  a calendar. Your manual availability keeps working either way.
                </p>
              )}
            </div>

            <p className="text-xs text-ink-500">
              Manual availability: {formatPercent(data?.manualAvailabilityPercent ?? 100)}
              {" "}({humanize("always active")}).
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}