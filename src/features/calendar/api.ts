import { api } from "@/lib/api";

import type {
  CalendarAttendee,
  CalendarDayGroup,
  CalendarEvent,
  CalendarSource,
  CalendarTab,
  CalendarTimeWindow,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function startOfLocalDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toRfc3339Local(d: Date): string {
  return d.toISOString();
}

/** Monday 00:00 local → next Monday 00:00 */
export function weekBounds(now = new Date()): { start: Date; end: Date } {
  const start = startOfLocalDay(now);
  const day = (start.getDay() + 6) % 7; // Mon=0
  start.setDate(start.getDate() - day);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function windowForTab(
  tab: CalendarTab,
  now = new Date(),
): CalendarTimeWindow {
  const today = startOfLocalDay(now);
  if (tab === "today") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return {
      timeMin: toRfc3339Local(today),
      timeMax: toRfc3339Local(end),
      label: "Today",
    };
  }
  if (tab === "week") {
    const { start, end } = weekBounds(now);
    return {
      timeMin: toRfc3339Local(start),
      timeMax: toRfc3339Local(end),
      label: "This week",
    };
  }
  // upcoming + allday use same 7d window; allday filters client-side
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  return {
    timeMin: toRfc3339Local(today),
    timeMax: toRfc3339Local(end),
    label: tab === "allday" ? "All-day" : "Upcoming",
  };
}

function parseSlot(
  slot: unknown,
  end: boolean,
): { ms: number; allDay: boolean } | null {
  const rec = asRecord(slot);
  if (!rec) return null;
  const dateTime = typeof rec.dateTime === "string" ? rec.dateTime : "";
  if (dateTime) {
    const ms = Date.parse(dateTime);
    return Number.isNaN(ms) ? null : { ms, allDay: false };
  }
  const date = typeof rec.date === "string" ? rec.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parts = date.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const local = new Date(y, m - 1, d);
  if (end) local.setDate(local.getDate() - 1);
  return { ms: local.getTime(), allDay: true };
}

function mapAttendees(raw: unknown): CalendarAttendee[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarAttendee[] = [];
  for (const row of raw) {
    const rec = asRecord(row);
    if (!rec) continue;
    const email = typeof rec.email === "string" ? rec.email : "";
    if (!email) continue;
    out.push({
      email,
      displayName:
        typeof rec.displayName === "string" ? rec.displayName : undefined,
      self: rec.self === true,
      responseStatus:
        typeof rec.responseStatus === "string" ? rec.responseStatus : undefined,
    });
  }
  return out;
}

function extractHangout(rec: Record<string, unknown>): string | null {
  if (typeof rec.hangoutLink === "string" && rec.hangoutLink.trim()) {
    return rec.hangoutLink.trim();
  }
  const conf = asRecord(rec.conferenceData);
  const entries = conf?.entryPoints;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    const e = asRecord(entry);
    if (!e) continue;
    if (e.entryPointType === "video" && typeof e.uri === "string") {
      return e.uri;
    }
  }
  return null;
}

export function mapGoogleEvent(
  raw: unknown,
  calendarId = "primary",
): CalendarEvent | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = typeof rec.id === "string" ? rec.id : "";
  if (!id) return null;
  const start = parseSlot(rec.start, false);
  const end = parseSlot(rec.end, true);
  if (!start) return null;
  return {
    id,
    calendarId,
    title:
      typeof rec.summary === "string" && rec.summary.trim()
        ? rec.summary
        : "(No title)",
    htmlLink: typeof rec.htmlLink === "string" ? rec.htmlLink : "",
    location:
      typeof rec.location === "string" && rec.location.trim()
        ? rec.location
        : null,
    description:
      typeof rec.description === "string" && rec.description.trim()
        ? rec.description
        : null,
    hangoutLink: extractHangout(rec),
    allDay: start.allDay,
    startMs: start.ms,
    endMs: end?.ms ?? start.ms,
    attendees: mapAttendees(rec.attendees),
  };
}

export function groupEventsByDay(events: CalendarEvent[]): CalendarDayGroup[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = new Date(event.startMs);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, items]) => ({
      key,
      label: new Date(items[0]!.startMs).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      items: items.sort((a, b) => a.startMs - b.startMs),
    }));
}

export function formatEventWhen(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  const start = new Date(event.startMs);
  const end = new Date(event.endMs);
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${start.toLocaleTimeString(undefined, opts)}–${end.toLocaleTimeString(undefined, opts)}`;
}

export function filterEvents(
  events: CalendarEvent[],
  opts: { tab: CalendarTab; query: string },
): CalendarEvent[] {
  let list = events;
  if (opts.tab === "allday") list = list.filter((e) => e.allDay);
  const q = opts.query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.location?.toLowerCase().includes(q) ?? false),
    );
  }
  return list;
}

export async function fetchCalendarList(): Promise<CalendarSource[]> {
  const data = await api.googleApiRequest<{ items?: unknown[] }>(
    "GET",
    "calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50",
  );
  const out: CalendarSource[] = [];
  for (const raw of data.items ?? []) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const id = typeof rec.id === "string" ? rec.id : "";
    if (!id) continue;
    out.push({
      id,
      summary:
        typeof rec.summary === "string" && rec.summary.trim()
          ? rec.summary
          : id,
      primary: rec.primary === true,
      backgroundColor:
        typeof rec.backgroundColor === "string"
          ? rec.backgroundColor
          : undefined,
    });
  }
  out.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.summary.localeCompare(b.summary);
  });
  return out;
}

export async function fetchCalendarEvents(input: {
  calendarId?: string;
  tab?: CalendarTab;
  timeMin?: string;
  timeMax?: string;
}): Promise<CalendarEvent[]> {
  const calendarId = input.calendarId?.trim() || "primary";
  const win = windowForTab(input.tab ?? "upcoming");
  const timeMin = input.timeMin ?? win.timeMin;
  const timeMax = input.timeMax ?? win.timeMax;
  const path = `calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
  const data = await api.googleApiRequest<{ items?: unknown[] }>("GET", path);
  return (data.items ?? [])
    .map((raw) => mapGoogleEvent(raw, calendarId))
    .filter((event): event is CalendarEvent => event != null);
}

export async function fetchCalendarEvent(
  calendarId: string,
  eventId: string,
): Promise<CalendarEvent> {
  const cal = calendarId.trim() || "primary";
  const id = eventId.trim();
  const path = `calendar/v3/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(id)}`;
  const raw = await api.googleApiRequest("GET", path);
  const event = mapGoogleEvent(raw, cal);
  if (!event) throw new Error("Event not found");
  return event;
}

export function calendarErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/accessNotConfigured|Calendar API has not been used/i.test(text)) {
    return "Google Calendar API is not enabled for this OAuth project. Enable it in Google Cloud Console.";
  }
  return (
    text
      .replace(/^google error \d+:\s*/i, "")
      .replace(/^google oauth:\s*/i, "") || "Google Calendar request failed"
  );
}
