import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CalendarEventRow,
  eventPhase,
  formatDuration,
} from "./CalendarEventRow";
import type { CalendarEvent } from "./types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    calendarId: "primary",
    title: "Team sync",
    htmlLink: "https://calendar.google.com/event?eid=1",
    location: "Room A",
    description: null,
    hangoutLink: null,
    allDay: false,
    startMs: Date.parse("2026-09-15T02:00:00Z"),
    endMs: Date.parse("2026-09-15T03:00:00Z"),
    attendees: [],
    ...overrides,
  };
}

describe("CalendarEventRow helpers", () => {
  it("eventPhase classifies past, current, and upcoming events", () => {
    const event = makeEvent({
      startMs: 1000,
      endMs: 2000,
    });
    expect(eventPhase(event, 500)).toBe("upcoming");
    expect(eventPhase(event, 1500)).toBe("current");
    expect(eventPhase(event, 2500)).toBe("past");
  });

  it("formatDuration covers all-day, short, and hour spans", () => {
    expect(formatDuration(makeEvent({ allDay: true }))).toBe("All day");
    expect(
      formatDuration(
        makeEvent({
          startMs: 0,
          endMs: 30 * 60_000,
        }),
      ),
    ).toBe("30m");
    expect(
      formatDuration(
        makeEvent({
          startMs: 0,
          endMs: 90 * 60_000,
        }),
      ),
    ).toBe("1h 30m");
    expect(
      formatDuration(
        makeEvent({
          startMs: 0,
          endMs: 2 * 60 * 60_000,
        }),
      ),
    ).toBe("2h");
    expect(
      formatDuration(
        makeEvent({
          startMs: 1000,
          endMs: 1000,
        }),
      ),
    ).toBeNull();
  });
});

describe("CalendarEventRow", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-15T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders status badges, meet link, calendar name, and attendees", () => {
    const event = makeEvent({
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      attendees: [
        { email: "alice@example.com", displayName: "Alice" },
        { email: "bob@example.com" },
        { email: "carol@example.com", displayName: "Carol" },
        { email: "dave@example.com" },
      ],
    });

    render(
      <MemoryRouter>
        <ul>
          <CalendarEventRow
            event={event}
            calendarName="Work"
            calendarColor="#336699"
          />
        </ul>
      </MemoryRouter>,
    );

    expect(screen.getByText("Team sync")).toBeInTheDocument();
    expect(screen.getByText("Meet")).toBeInTheDocument();
    expect(screen.getByText("Happening")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText(/Alice, bob, Carol \+1/)).toBeInTheDocument();
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/calendar/primary/evt-1",
    );

    expect(eventPhase(event)).toBe("current");
  });

  it("renders ended state for past events", () => {
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    const event = makeEvent({
      startMs: Date.parse("2026-09-15T01:00:00Z"),
      endMs: Date.parse("2026-09-15T01:30:00Z"),
    });
    render(
      <MemoryRouter>
        <ul>
          <CalendarEventRow event={event} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });
});
