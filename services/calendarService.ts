import { connectDB } from "@/lib/db/connect";
import { HttpError } from "@/lib/api/http-error";
import { UserModel } from "@/models/User";
import { EmployeeModel } from "@/models/Employee";

/**
 * Optional Google Calendar integration.
 *
 * Privacy contract — this module is deliberately narrow:
 *   * only `calendar.readonly` scope is ever requested;
 *   * event titles, attendees and descriptions are NEVER read or stored;
 *   * only a single derived number ("free capacity in the next 14 days") is kept;
 *   * managers see that number, never the underlying events;
 *   * when the API is unavailable the employee simply keeps their manually
 *     entered availability and nothing else breaks.
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_FREE_BUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

const WINDOW_DAYS = 14;
const WORKDAY_HOURS = 8;
const WINDOW_WORKHOURS = WINDOW_DAYS * WORKDAY_HOURS;

export interface CalendarStatus {
  configured: boolean;
  connected: boolean;
  lastSyncedAt: string | null;
  /** The percentage derived from the calendar, or null when not connected. */
  calendarAvailabilityPercent: number | null;
  /** Manually entered availability — always the fallback. */
  manualAvailabilityPercent: number;
  note: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

interface GoogleTokenResponse {
  access_token?: string;
  error_description?: string;
}

/** Exchanges the stored refresh token for a short-lived access token. */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw HttpError.serviceUnavailable(
      "Google rejected the calendar refresh token. Please sign in again."
    );
  }

  const payload = (await response.json()) as GoogleTokenResponse;
  if (!payload.access_token) {
    throw HttpError.serviceUnavailable(
      payload.error_description ?? "Google did not return an access token."
    );
  }
  return payload.access_token;
}

/** Derives an availability percentage from busy blocks. */
function deriveAvailability(
  busyBlocks: Array<{ start?: string; end?: string }>
): number {
  const busyHours = busyBlocks.reduce((total, block) => {
    if (!block.start || !block.end) return total;
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return total;
    return total + Math.min((end - start) / 3_600_000, WORKDAY_HOURS * WINDOW_DAYS);
  }, 0);

  const freeRatio = Math.max(0, Math.min(1, 1 - busyHours / WINDOW_WORKHOURS));
  return Math.round(freeRatio * 100);
}
/**
 * Fetches the signed-in user's calendar availability and stores the derived
 * number on their employee profile. Only busy intervals are read.
 */
export async function syncCalendarAvailability(
  userId: string
): Promise<CalendarStatus> {
  await connectDB();
  if (!isGoogleConfigured()) {
    throw HttpError.serviceUnavailable(
      "Google OAuth is not configured on this deployment, so calendar sync is unavailable."
    );
  }

  const user = await UserModel.findById(userId).select(
    "+googleRefreshToken +googleAccessToken +googleTokenExpiry"
  );
  if (!user) throw HttpError.notFound("That user does not exist.");
  if (!user.googleRefreshToken) {
    throw HttpError.conflict(
      "No Google Calendar is connected. Sign in with Google and grant calendar access."
    );
  }

  const token = await refreshAccessToken(user.googleRefreshToken);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();

  // freeBusy returns only "busy" intervals — never event titles or attendees.
  const response = await fetch(CALENDAR_FREE_BUSY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw HttpError.serviceUnavailable(
      "Google Calendar could not be reached. Your manual availability is still being used."
    );
  }

  const payload = (await response.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };
  const availability = deriveAvailability(payload.calendars?.primary?.busy ?? []);

  const now = new Date();
  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        googleAccessToken: token,
        googleTokenExpiry: new Date(now.getTime() + 55 * 60_000),
        calendarConnected: true,
        calendarLastSyncedAt: now,
      },
    }
  );
  await EmployeeModel.updateOne(
    { userId: user._id },
    { $set: { calendarAvailabilityPercent: availability } }
  );

  return {
    configured: true,
    connected: true,
    lastSyncedAt: now.toISOString(),
    calendarAvailabilityPercent: availability,
    manualAvailabilityPercent: 0,
    note: "Availability derived from busy time only — no event details are stored.",
  };
}

/** Current calendar integration status (never throws when offline). */
export async function getCalendarStatus(
  userId: string,
  employeeId: string | null
): Promise<CalendarStatus> {
  await connectDB();

  const user = await UserModel.findById(userId).select("calendarConnected calendarLastSyncedAt");
  const employee = employeeId
    ? await EmployeeModel.findById(employeeId)
        .select("availabilityPercent calendarAvailabilityPercent")
        .lean()
    : null;

  const connected = Boolean(user?.calendarConnected);

  return {
    configured: isGoogleConfigured(),
    connected,
    lastSyncedAt: user?.calendarLastSyncedAt
      ? new Date(user.calendarLastSyncedAt).toISOString()
      : null,
    calendarAvailabilityPercent: employee?.calendarAvailabilityPercent ?? null,
    manualAvailabilityPercent: employee?.availabilityPercent ?? 100,
    note: connected
      ? "Google Calendar is connected and adjusts your availability score."
      : "Not connected — the availability you set manually is used instead.",
  };
}

/** Lets an employee opt out and fall back to manual availability. */
export async function disconnectCalendar(userId: string): Promise<CalendarStatus> {
  await connectDB();
  const user = await UserModel.findById(userId);
  if (!user) throw HttpError.notFound("That user does not exist.");

  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        calendarConnected: false,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      },
    }
  );
  await EmployeeModel.updateOne(
    { userId: user._id },
    { $set: { calendarAvailabilityPercent: null } }
  );

  return getCalendarStatus(userId, null);
}
