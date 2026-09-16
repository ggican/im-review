import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/features/calendar/types";
import type { GmailMessageSummary } from "@/features/gmail/types";
import type { JiraIssue } from "@/features/jira/types";
import type { CiWatchHit } from "@/features/pr/ci-watch";
import { makePr } from "@/test/fixtures";

import {
  NeedsMeSection,
  TodayHeader,
  TodaySidePreviews,
  TodaySummaryCards,
} from "./TodayView";

function makeJira(key: string, summary = "Fix bug"): JiraIssue {
  return {
    id: key,
    key,
    summary,
    status: { id: "1", name: "In Progress", category: "indeterminate" },
    type: { id: "2", name: "Bug", iconUrl: "", subtask: false },
    parent: null,
    labels: [],
    assignee: { displayName: "Alice", avatarUrl: "" },
    priority: "High",
    updatedAt: "2026-01-01T12:00:00.000Z",
    browseUrl: `https://example.atlassian.net/browse/${key}`,
    devStart: null,
    devEnd: null,
    storyPoints: null,
  };
}

function makeMail(
  overrides: Partial<GmailMessageSummary> & { id: string },
): GmailMessageSummary {
  return {
    threadId: `t-${overrides.id}`,
    subject: overrides.subject ?? "Hello",
    from: overrides.from ?? "bob@example.com",
    snippet: overrides.snippet ?? "Please review",
    date: overrides.date ?? "2026-01-01T12:00:00.000Z",
    dateMs: overrides.dateMs ?? Date.parse("2026-01-01T12:00:00.000Z"),
    labelIds: overrides.labelIds ?? ["UNREAD"],
    unread: overrides.unread ?? true,
    starred: overrides.starred ?? false,
    ...overrides,
  };
}

function makeEvent(
  overrides: Partial<CalendarEvent> & { id: string; title: string },
): CalendarEvent {
  return {
    calendarId: overrides.calendarId ?? "primary",
    htmlLink: overrides.htmlLink ?? "https://calendar.google.com",
    location: overrides.location ?? null,
    description: overrides.description ?? null,
    hangoutLink: overrides.hangoutLink ?? null,
    allDay: overrides.allDay ?? false,
    startMs: overrides.startMs ?? Date.parse("2026-01-01T14:00:00.000Z"),
    endMs: overrides.endMs ?? Date.parse("2026-01-01T15:00:00.000Z"),
    attendees: overrides.attendees ?? [],
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("TodaySummaryCards", () => {
  it("shows disconnected placeholders for Jira and Google", () => {
    renderWithRouter(
      <TodaySummaryCards
        needsMe={3}
        prReview={2}
        prMine={1}
        ciFails={1}
        jiraCount={5}
        jiraConnected={false}
        meetingCount={4}
        nextMeetingLabel="2:00 PM Standup"
        googleConnected={false}
      />,
    );

    expect(screen.getByLabelText("Today summary")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByText("Connect in Settings")).toBeInTheDocument();
    expect(screen.getByText("Connect Google")).toBeInTheDocument();
    expect(screen.getByText("Needs me").closest("section")).toHaveTextContent(
      "3",
    );
    expect(
      screen.getByText(/2 awaiting review · 1 CI fail/),
    ).toBeInTheDocument();
  });

  it("shows connected counts and next meeting", () => {
    renderWithRouter(
      <TodaySummaryCards
        needsMe={0}
        prReview={0}
        prMine={0}
        ciFails={0}
        jiraCount={7}
        jiraConnected
        meetingCount={2}
        nextMeetingLabel="3:30 PM Sync"
        googleConnected
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Assigned to you")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3:30 PM Sync")).toBeInTheDocument();
  });
});

describe("NeedsMeSection", () => {
  const reviewPr = makePr({
    repo: "acme/app",
    number: 42,
    title: "Add feature",
    author: { login: "bob", avatarUrl: "https://avatars/bob" },
    isDraft: true,
  });
  const reviewedPr = makePr({
    repo: "acme/app",
    number: 10,
    title: "Already done",
    localReviewEvent: "APPROVE",
  });
  const ciHit: CiWatchHit = {
    pr: makePr({ repo: "acme/ci", number: 5, title: "Broken build" }),
    ciStatus: "failure",
    description: "Jenkins failed",
  };
  const jira = makeJira("TTD-100");
  const gmail = makeMail({ id: "g1", subject: "Urgent review" });

  const baseProps = {
    filter: "all" as const,
    onFilterChange: vi.fn(),
    reviewPrs: [reviewPr],
    reviewedPrs: [reviewedPr],
    ciHits: [ciHit],
    jira: [jira],
    gmail: [gmail],
    jiraConnected: true,
    googleConnected: true,
    loading: false,
    prLoading: false,
    prError: null,
    onSelectPr: vi.fn(),
    counts: { all: 4, prs: 2, jira: 1, mail: 1 },
  };

  it("renders all item kinds on the all tab", () => {
    renderWithRouter(<NeedsMeSection {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: "Needs me" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Add feature")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Broken build")).toBeInTheDocument();
    expect(screen.getByText("CI failed")).toBeInTheDocument();
    expect(screen.getByText("TTD-100")).toBeInTheDocument();
    expect(screen.getByText("Urgent review")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Already reviewed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Jira" })).toHaveAttribute(
      "href",
      "/jira/TTD-100",
    );
  });

  it("filters by source tab", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    renderWithRouter(
      <NeedsMeSection {...baseProps} onFilterChange={onFilterChange} />,
    );

    await user.click(screen.getByRole("tab", { name: /Jira/ }));
    expect(onFilterChange).toHaveBeenCalledWith("jira");
  });

  it("shows disconnected empty states with settings links", () => {
    renderWithRouter(
      <NeedsMeSection
        {...baseProps}
        filter="jira"
        jira={[]}
        jiraConnected={false}
        counts={{ all: 0, prs: 0, jira: 0, mail: 0 }}
        reviewPrs={[]}
        reviewedPrs={[]}
        ciHits={[]}
        gmail={[]}
      />,
    );

    expect(
      screen.getByText("Connect Jira in Settings to see assigned issues."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("shows clear state when nothing needs attention", () => {
    renderWithRouter(
      <NeedsMeSection
        {...baseProps}
        reviewPrs={[]}
        reviewedPrs={[]}
        ciHits={[]}
        jira={[]}
        gmail={[]}
        counts={{ all: 0, prs: 0, jira: 0, mail: 0 }}
      />,
    );

    expect(screen.getByText("You’re clear")).toBeInTheDocument();
    expect(screen.getByText(/Nothing needs you right now/)).toBeInTheDocument();
  });

  it("shows PR error and loading states", () => {
    const { rerender } = renderWithRouter(
      <NeedsMeSection
        {...baseProps}
        prError="GitHub unavailable"
        reviewPrs={[]}
        reviewedPrs={[]}
        ciHits={[]}
        jira={[]}
        gmail={[]}
      />,
    );
    expect(screen.getByText("GitHub unavailable")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <NeedsMeSection
          {...baseProps}
          loading
          reviewPrs={[]}
          reviewedPrs={[]}
          ciHits={[]}
          jira={[]}
          gmail={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading today’s work…")).toBeInTheDocument();
  });

  it("calls onSelectPr when Review Diff is clicked", async () => {
    const user = userEvent.setup();
    const onSelectPr = vi.fn();
    renderWithRouter(
      <NeedsMeSection
        {...baseProps}
        onSelectPr={onSelectPr}
        jira={[]}
        gmail={[]}
        ciHits={[]}
        counts={{ all: 1, prs: 1, jira: 0, mail: 0 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Review Diff" }));
    expect(onSelectPr).toHaveBeenCalledWith(reviewPr);
  });

  it("calls onSelectPr from CI inspect and reviewed rows", async () => {
    const user = userEvent.setup();
    const onSelectPr = vi.fn();
    renderWithRouter(
      <NeedsMeSection
        {...baseProps}
        onSelectPr={onSelectPr}
        reviewPrs={[]}
        jira={[]}
        gmail={[]}
        counts={{ all: 2, prs: 2, jira: 0, mail: 0 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Inspect" }));
    expect(onSelectPr).toHaveBeenCalledWith(ciHit.pr);

    await user.click(screen.getByRole("button", { name: /Already done/ }));
    expect(onSelectPr).toHaveBeenCalledWith(reviewedPr);
  });
});

describe("TodaySidePreviews", () => {
  const events = [
    makeEvent({
      id: "e1",
      title: "Standup",
      hangoutLink: "https://meet.google.com/abc",
    }),
    makeEvent({ id: "e2", title: "Design review" }),
  ];
  const gmail = makeMail({ id: "m1", subject: "Inbox item" });
  const jira = [
    makeJira("TTD-1"),
    makeJira("TTD-2"),
    makeJira("TTD-3"),
    makeJira("TTD-4"),
  ];

  it("shows disconnected Google and Jira cards", () => {
    renderWithRouter(
      <TodaySidePreviews
        calendar={[]}
        gmail={[]}
        jira={[]}
        googleConnected={false}
        jiraConnected={false}
        calendarError={null}
        gmailError={null}
        jiraError={null}
        loading={false}
      />,
    );

    expect(
      screen.getByText("Connect Google in Settings to sync meetings."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connect Google to preview unread mail."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Connect Jira to preview your work."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Settings" }).length,
    ).toBeGreaterThan(0);
  });

  it("shows schedule, mail preview, and jira list when connected", () => {
    renderWithRouter(
      <TodaySidePreviews
        calendar={events}
        gmail={[gmail]}
        jira={jira}
        googleConnected
        jiraConnected
        calendarError={null}
        gmailError={null}
        jiraError={null}
        loading={false}
      />,
    );

    expect(screen.getByText("Today’s schedule")).toBeInTheDocument();
    expect(screen.getByText("Next up")).toBeInTheDocument();
    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join Meet" })).toHaveAttribute(
      "href",
      "https://meet.google.com/abc",
    );
    expect(screen.getByText("Inbox item")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open mail" })).toHaveAttribute(
      "href",
      "/gmail/m1",
    );
    expect(screen.getAllByRole("link", { name: /TTD-/ })).toHaveLength(3);
  });

  it("shows sync errors", () => {
    renderWithRouter(
      <TodaySidePreviews
        calendar={[]}
        gmail={[]}
        jira={[]}
        googleConnected
        jiraConnected
        calendarError="Calendar sync failed"
        gmailError="Gmail sync failed"
        jiraError="Jira sync failed"
        loading={false}
      />,
    );

    expect(screen.getByText("Calendar sync failed")).toBeInTheDocument();
    expect(screen.getByText("Gmail sync failed")).toBeInTheDocument();
    expect(screen.getByText("Jira sync failed")).toBeInTheDocument();
  });

  it("shows empty connected states without errors", () => {
    renderWithRouter(
      <TodaySidePreviews
        calendar={[]}
        gmail={[]}
        jira={[]}
        googleConnected
        jiraConnected
        calendarError={null}
        gmailError={null}
        jiraError={null}
        loading={false}
      />,
    );

    expect(screen.getByText("No meetings left today.")).toBeInTheDocument();
    expect(screen.getByText("No open issues assigned.")).toBeInTheDocument();
    expect(
      screen.getByText("No unread messages in preview."),
    ).toBeInTheDocument();
  });

  it("shows loading indicator", () => {
    renderWithRouter(
      <TodaySidePreviews
        calendar={[]}
        gmail={[]}
        jira={[]}
        googleConnected
        jiraConnected
        calendarError={null}
        gmailError={null}
        jiraError={null}
        loading
      />,
    );

    expect(screen.getByText("Loading agenda…")).toBeInTheDocument();
  });
});

describe("TodayHeader", () => {
  it("renders greeting, action count, and navigation links", () => {
    renderWithRouter(
      <TodayHeader
        userName="Ikhsan Mahendri"
        userLogin="ikhsan"
        actionCount={2}
        onRefresh={vi.fn()}
        refreshing={false}
        favoritesCount={3}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Ikhsan/,
    );
    expect(screen.getByText(/2 high-priority actions/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute(
      "href",
      "/people",
    );
    expect(screen.getByRole("link", { name: /Repos/ })).toHaveAttribute(
      "href",
      "/repos",
    );
  });

  it("shows caught-up message and calls refresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderWithRouter(
      <TodayHeader
        userName={null}
        userLogin="dev"
        actionCount={0}
        onRefresh={onRefresh}
        refreshing={false}
        favoritesCount={0}
      />,
    );

    expect(screen.getByText(/caught up on priority items/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh while refreshing", () => {
    renderWithRouter(
      <TodayHeader
        userName="Dev"
        userLogin="dev"
        actionCount={1}
        onRefresh={vi.fn()}
        refreshing
        favoritesCount={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  describe("greeting by time of day", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows afternoon and evening greetings", () => {
      vi.setSystemTime(new Date("2026-09-15T14:00:00"));
      const { rerender } = renderWithRouter(
        <TodayHeader
          userName="Dev"
          userLogin="dev"
          actionCount={1}
          onRefresh={vi.fn()}
          refreshing={false}
          favoritesCount={0}
        />,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /Good afternoon/,
      );

      vi.setSystemTime(new Date("2026-09-15T20:00:00"));
      rerender(
        <MemoryRouter>
          <TodayHeader
            userName="Dev"
            userLogin="dev"
            actionCount={1}
            onRefresh={vi.fn()}
            refreshing={false}
            favoritesCount={0}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /Good evening/,
      );
    });
  });
});
