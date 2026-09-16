import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import {
  fetchCalendarEvent,
  fetchCalendarEvents,
  fetchCalendarList,
} from "./api";
import { CalendarEventPage } from "./CalendarEventPage";
import { CalendarPage } from "./CalendarPage";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchCalendarEvents: vi.fn(),
    fetchCalendarList: vi.fn(),
    fetchCalendarEvent: vi.fn(),
  };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

function renderCalendar() {
  return render(
    <MemoryRouter initialEntries={["/calendar"]}>
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route
          path="/calendar/:calendarId/:eventId"
          element={<CalendarEventPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CalendarPage", () => {
  beforeEach(() => {
    saveGooglePublic(null);
    vi.mocked(fetchCalendarEvents).mockReset();
    vi.mocked(fetchCalendarList).mockReset();
    vi.mocked(fetchCalendarEvent).mockReset();
    vi.mocked(fetchCalendarList).mockResolvedValue([
      { id: "primary", summary: "Primary", primary: true },
    ]);
  });

  it("prompts to connect when Google is not linked", () => {
    renderCalendar();
    expect(
      screen.getByRole("heading", { name: "Calendar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("lists events and opens detail route", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarEvents).mockResolvedValue([
      {
        id: "1",
        calendarId: "primary",
        title: "Standup",
        htmlLink: "https://calendar.google.com/event?eid=1",
        location: "Meet",
        description: null,
        hangoutLink: "https://meet.google.com/abc",
        allDay: false,
        startMs: Date.parse("2026-09-15T02:00:00Z"),
        endMs: Date.parse("2026-09-15T02:30:00Z"),
        attendees: [],
      },
    ]);
    vi.mocked(fetchCalendarEvent).mockResolvedValue({
      id: "1",
      calendarId: "primary",
      title: "Standup",
      htmlLink: "https://calendar.google.com/event?eid=1",
      location: "Meet",
      description: "Daily sync",
      hangoutLink: "https://meet.google.com/abc",
      allDay: false,
      startMs: Date.parse("2026-09-15T02:00:00Z"),
      endMs: Date.parse("2026-09-15T02:30:00Z"),
      attendees: [{ email: "alice@example.com", self: true }],
    });

    renderCalendar();
    expect(await screen.findByText("Standup")).toBeInTheDocument();
    expect(screen.getAllByText("Meet").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: "Today" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("link", { name: /Standup/ }));
    expect(await screen.findByText("Daily sync")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Join Meet/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Join Meet/ }));
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith("https://meet.google.com/abc");
    });

    await user.click(screen.getByRole("button", { name: /Open in Calendar/ }));
    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith(
        "https://calendar.google.com/event?eid=1",
      );
    });
  });

  it("shows empty agenda copy when there are no events", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarEvents).mockResolvedValue([]);
    renderCalendar();
    expect(
      await screen.findByText("No events on the agenda."),
    ).toBeInTheDocument();
  });

  it("shows no upcoming events when Upcoming tab is empty", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarEvents).mockResolvedValue([]);
    renderCalendar();
    await screen.findByText("No events on the agenda.");
    await user.click(screen.getByRole("tab", { name: "Upcoming" }));
    expect(await screen.findByText("No upcoming events.")).toBeInTheDocument();
  });

  it("shows fetch error, refresh, calendar picker, and search filter", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarList).mockResolvedValue([
      {
        id: "work",
        summary: "Work",
        primary: false,
        backgroundColor: "#3367d6",
      },
      { id: "primary", summary: "Primary", primary: true },
    ]);
    vi.mocked(fetchCalendarEvents).mockRejectedValueOnce(
      new Error("Calendar API down"),
    );

    renderCalendar();
    expect(await screen.findByText(/Calendar API down/)).toBeInTheDocument();

    vi.mocked(fetchCalendarEvents).mockResolvedValue([
      {
        id: "1",
        calendarId: "work",
        title: "Planning",
        htmlLink: "https://calendar.google.com/event?eid=1",
        location: null,
        description: null,
        hangoutLink: null,
        allDay: false,
        startMs: Date.parse("2026-09-15T02:00:00Z"),
        endMs: Date.parse("2026-09-15T03:00:00Z"),
        attendees: [],
      },
      {
        id: "2",
        calendarId: "work",
        title: "Other meeting",
        htmlLink: "https://calendar.google.com/event?eid=2",
        location: null,
        description: null,
        hangoutLink: null,
        allDay: false,
        startMs: Date.parse("2026-09-16T02:00:00Z"),
        endMs: Date.parse("2026-09-16T03:00:00Z"),
        attendees: [],
      },
    ]);
    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByText("Planning")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Calendar" }));
    await user.click(screen.getByRole("option", { name: /Work/ }));
    await waitFor(() => {
      expect(fetchCalendarEvents).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: "work" }),
      );
    });

    await user.type(
      screen.getByRole("textbox", { name: "Search events" }),
      "Planning",
    );
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.queryByText("Other meeting")).not.toBeInTheDocument();
  });

  it("shows all-day tab empty copy", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarEvents).mockResolvedValue([]);
    renderCalendar();
    await screen.findByText("No events on the agenda.");
    await user.click(screen.getByRole("tab", { name: "All-day" }));
    expect(await screen.findByText("No all-day events.")).toBeInTheDocument();
  });

  it("shows event not found on detail when fetch fails", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchCalendarEvent).mockRejectedValue(new Error("not found"));
    render(
      <MemoryRouter initialEntries={["/calendar/primary/missing"]}>
        <Routes>
          <Route
            path="/calendar/:calendarId/:eventId"
            element={<CalendarEventPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
  });
});
