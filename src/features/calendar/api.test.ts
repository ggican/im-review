import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    googleApiRequest: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import {
  calendarErrorMessage,
  fetchCalendarEvent,
  fetchCalendarEvents,
  fetchCalendarList,
  filterEvents,
  formatEventWhen,
  groupEventsByDay,
  mapGoogleEvent,
  windowForTab,
} from "./api";

const mockGoogleApiRequest = vi.mocked(api.googleApiRequest);
import type { CalendarEvent } from "./types";

describe("calendar mappers", () => {
  beforeEach(() => {
    mockGoogleApiRequest.mockReset();
  });

  it("maps timed, all-day, meet, and attendees", () => {
    const timed = mapGoogleEvent({
      id: "1",
      summary: "Standup",
      htmlLink: "https://calendar.google.com/event?eid=1",
      location: "Meet",
      hangoutLink: "https://meet.google.com/abc",
      description: "Daily",
      attendees: [{ email: "a@x.com", displayName: "A", self: true }],
      start: { dateTime: "2026-09-15T02:00:00Z" },
      end: { dateTime: "2026-09-15T02:30:00Z" },
    });
    expect(timed).toMatchObject({
      id: "1",
      title: "Standup",
      hangoutLink: "https://meet.google.com/abc",
      allDay: false,
    });
    expect(timed?.attendees).toHaveLength(1);

    const allDay = mapGoogleEvent({
      id: "2",
      start: { date: "2026-09-16" },
      end: { date: "2026-09-17" },
    });
    expect(allDay?.allDay).toBe(true);
    expect(formatEventWhen(allDay!)).toBe("All day");
  });

  it("groups events by local day", () => {
    const a = mapGoogleEvent({
      id: "a",
      summary: "Later",
      start: { dateTime: "2026-09-15T10:00:00+07:00" },
      end: { dateTime: "2026-09-15T11:00:00+07:00" },
    })!;
    const b = mapGoogleEvent({
      id: "b",
      summary: "Earlier",
      start: { dateTime: "2026-09-15T08:00:00+07:00" },
      end: { dateTime: "2026-09-15T09:00:00+07:00" },
    })!;
    const groups = groupEventsByDay([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("builds tab windows and filters", () => {
    const now = new Date("2026-09-15T10:00:00+07:00");
    const today = windowForTab("today", now);
    expect(today.label).toBe("Today");
    expect(Date.parse(today.timeMax)).toBeGreaterThan(
      Date.parse(today.timeMin),
    );

    const week = windowForTab("week", now);
    expect(week.label).toBe("This week");

    const events: CalendarEvent[] = [
      {
        id: "1",
        calendarId: "primary",
        title: "Standup",
        htmlLink: "",
        location: null,
        description: null,
        hangoutLink: null,
        allDay: false,
        startMs: now.getTime(),
        endMs: now.getTime() + 3600000,
        attendees: [],
      },
      {
        id: "2",
        calendarId: "primary",
        title: "Holiday",
        htmlLink: "",
        location: null,
        description: null,
        hangoutLink: null,
        allDay: true,
        startMs: now.getTime(),
        endMs: now.getTime(),
        attendees: [],
      },
    ];
    expect(filterEvents(events, { tab: "allday", query: "" })).toHaveLength(1);
    expect(
      filterEvents(events, { tab: "upcoming", query: "stand" }),
    ).toHaveLength(1);
  });

  it("extracts hangout from conferenceData when hangoutLink is absent", () => {
    const event = mapGoogleEvent({
      id: "meet-1",
      summary: "Video sync",
      conferenceData: {
        entryPoints: [
          { entryPointType: "phone", uri: "tel:+1" },
          {
            entryPointType: "video",
            uri: "https://meet.google.com/xyz-abcd-efg",
          },
        ],
      },
      start: { dateTime: "2026-09-15T02:00:00Z" },
      end: { dateTime: "2026-09-15T03:00:00Z" },
    });
    expect(event?.hangoutLink).toBe("https://meet.google.com/xyz-abcd-efg");
  });

  it("returns null for invalid google events", () => {
    expect(mapGoogleEvent(null)).toBeNull();
    expect(mapGoogleEvent({ summary: "No id" })).toBeNull();
    expect(
      mapGoogleEvent({
        id: "bad",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "2026-09-15T03:00:00Z" },
      }),
    ).toBeNull();
  });

  it("calendarErrorMessage normalizes API and config errors", () => {
    expect(
      calendarErrorMessage(
        new Error("accessNotConfigured: Calendar API has not been used"),
      ),
    ).toContain("Google Calendar API is not enabled");
    expect(calendarErrorMessage(new Error("google error 403: forbidden"))).toBe(
      "forbidden",
    );
    expect(calendarErrorMessage("")).toBe("Google Calendar request failed");
  });

  it("fetchCalendarList maps and sorts calendars", async () => {
    mockGoogleApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: "work@corp.com",
          summary: "Work",
          backgroundColor: "#336699",
        },
        { id: "primary", summary: "Primary", primary: true },
      ],
    });
    const list = await fetchCalendarList();
    expect(list[0]).toMatchObject({ id: "primary", primary: true });
    expect(list[1]).toMatchObject({ id: "work@corp.com", summary: "Work" });
    expect(mockGoogleApiRequest).toHaveBeenCalledWith(
      "GET",
      "calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50",
    );
  });

  it("fetchCalendarEvents maps API items for a calendar", async () => {
    mockGoogleApiRequest.mockResolvedValueOnce({
      items: [
        {
          id: "evt-1",
          summary: "Standup",
          start: { dateTime: "2026-09-15T02:00:00Z" },
          end: { dateTime: "2026-09-15T02:30:00Z" },
        },
      ],
    });
    const events = await fetchCalendarEvents({
      calendarId: "primary",
      tab: "today",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "evt-1", calendarId: "primary" });
  });

  it("fetchCalendarEvent throws when mapping fails", async () => {
    mockGoogleApiRequest.mockResolvedValueOnce({ id: "", summary: "Broken" });
    await expect(fetchCalendarEvent("primary", "missing")).rejects.toThrow(
      "Event not found",
    );
  });
});
