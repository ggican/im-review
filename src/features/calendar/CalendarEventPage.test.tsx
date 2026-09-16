import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import { fetchCalendarEvent } from "./api";
import { CalendarEventPage } from "./CalendarEventPage";
import type { CalendarEvent } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchCalendarEvent: vi.fn(),
  };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

const mockFetchCalendarEvent = vi.mocked(fetchCalendarEvent);
const mockOpenUrl = vi.mocked(openUrl);

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    calendarId: "primary",
    title: "Team sync",
    htmlLink: "https://calendar.google.com/event?eid=1",
    location: "Room A",
    description: "<p>Agenda items</p>",
    hangoutLink: "https://meet.google.com/abc-def",
    allDay: false,
    startMs: Date.parse("2026-09-15T02:00:00Z"),
    endMs: Date.parse("2026-09-15T03:00:00Z"),
    attendees: [
      {
        email: "alice@example.com",
        displayName: "Alice",
        self: true,
        responseStatus: "accepted",
      },
      {
        email: "bob@example.com",
        displayName: "Bob",
        self: false,
        responseStatus: "tentative",
      },
    ],
    ...overrides,
  };
}

function renderEvent(calendarId = "primary", eventId = "evt-1") {
  return render(
    <MemoryRouter initialEntries={[`/calendar/${calendarId}/${eventId}`]}>
      <Routes>
        <Route
          path="/calendar/:calendarId/:eventId"
          element={<CalendarEventPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CalendarEventPage", () => {
  beforeEach(() => {
    saveGooglePublic(null);
    mockFetchCalendarEvent.mockReset();
    mockOpenUrl.mockClear();
    vi.mocked(toast.error).mockClear();
    vi.setSystemTime(new Date("2026-09-15T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prompts to connect when Google is not linked", () => {
    renderEvent();
    expect(
      screen.getByText("Google Calendar not connected"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connect in Settings" }),
    ).toHaveAttribute("href", "/settings");
    expect(mockFetchCalendarEvent).not.toHaveBeenCalled();
  });

  it("shows loading then event details with meet and attendees", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(makeEvent());
    renderEvent();

    expect(screen.getByText("Loading event…")).toBeInTheDocument();
    expect(await screen.findByText("Team sync")).toBeInTheDocument();
    expect(screen.getByText("Agenda items")).toBeInTheDocument();
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("Happening")).toBeInTheDocument();
    expect(screen.getByText("Google Meet")).toBeInTheDocument();
    expect(mockFetchCalendarEvent).toHaveBeenCalledWith("primary", "evt-1");
  });

  it("opens meet and calendar links", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(makeEvent());
    renderEvent();
    await screen.findByText("Team sync");

    await user.click(screen.getByRole("button", { name: "Join Meet" }));
    expect(mockOpenUrl).toHaveBeenCalledWith("https://meet.google.com/abc-def");

    await user.click(screen.getByRole("button", { name: "Open in Calendar" }));
    expect(mockOpenUrl).toHaveBeenCalledWith(
      "https://calendar.google.com/event?eid=1",
    );
  });

  it("surfaces openUrl failures", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(makeEvent());
    mockOpenUrl.mockRejectedValueOnce(new Error("blocked"));
    renderEvent();
    await screen.findByText("Team sync");

    await user.click(screen.getByRole("button", { name: "Join Meet" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: blocked");
    });
  });

  it("surfaces calendar link openUrl failure", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(makeEvent());
    mockOpenUrl.mockRejectedValueOnce(new Error("calendar blocked"));
    renderEvent();
    await screen.findByText("Team sync");

    await user.click(screen.getByRole("button", { name: "Open in Calendar" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: calendar blocked",
      );
    });
  });

  it("shows error when fetch fails", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockRejectedValue(new Error("403 forbidden"));
    renderEvent();
    expect(await screen.findByText("403 forbidden")).toBeInTheDocument();
  });

  it("shows not found when event is null", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(null as unknown as CalendarEvent);
    renderEvent();
    expect(await screen.findByText("Event not found.")).toBeInTheDocument();
  });

  it("covers past event, no meet, empty description/location/attendees", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(
      makeEvent({
        title: "Past standup",
        hangoutLink: null,
        htmlLink: "",
        location: null,
        description: null,
        startMs: Date.parse("2026-09-14T02:00:00Z"),
        endMs: Date.parse("2026-09-14T03:00:00Z"),
        attendees: [],
      }),
    );
    renderEvent();
    expect(await screen.findByText("Past standup")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText("No location")).toBeInTheDocument();
    expect(
      screen.getByText("No Google Meet link on this event."),
    ).toBeInTheDocument();
    expect(screen.getByText("No description.")).toBeInTheDocument();
    expect(screen.getByText("No attendees listed.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Join Meet" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open in Calendar" }),
    ).not.toBeInTheDocument();
  });

  it("truncates attendee list beyond 20", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    mockFetchCalendarEvent.mockResolvedValue(
      makeEvent({
        attendees: Array.from({ length: 22 }, (_, i) => ({
          email: `user${i}@example.com`,
          displayName: `User ${i}`,
          self: false,
          responseStatus: "needsAction",
        })),
      }),
    );
    renderEvent();
    expect(await screen.findByText("Attendees (22)")).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
