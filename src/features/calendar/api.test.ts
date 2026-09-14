import { describe, expect, it } from "vitest";

import {
  filterEvents,
  formatEventWhen,
  groupEventsByDay,
  mapGoogleEvent,
  windowForTab,
} from "./api";
import type { CalendarEvent } from "./types";

describe("calendar mappers", () => {
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
    expect(Date.parse(today.timeMax)).toBeGreaterThan(Date.parse(today.timeMin));

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
    expect(filterEvents(events, { tab: "upcoming", query: "stand" })).toHaveLength(
      1,
    );
  });
});
