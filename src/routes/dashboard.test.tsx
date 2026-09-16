import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GmailMessageSummary } from "@/features/gmail/types";
import type { JiraIssue } from "@/features/jira/types";
import { getSettings, saveSettings } from "@/lib/settings";
import { makePr } from "@/test/fixtures";

function makeJira(key: string, summary: string): JiraIssue {
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

function makeMail(id: string, subject: string): GmailMessageSummary {
  return {
    id,
    threadId: `t-${id}`,
    subject,
    from: "bob@example.com",
    snippet: "Please review",
    date: "2026-01-01T12:00:00.000Z",
    dateMs: Date.parse("2026-01-01T12:00:00.000Z"),
    labelIds: ["UNREAD"],
    unread: true,
    starred: false,
  };
}

const mockNavigate = vi.fn();
const mockUseMyPRs = vi.fn();
const mockScanMineCiFailures = vi.fn();
const mockUpdateDesktopAlerts = vi.fn();
const mockSideRefresh = vi.fn();
const mockFetchOpenPrsByAuthor = vi.fn();
const mockSideData = {
  jira: [] as JiraIssue[],
  gmail: [] as GmailMessageSummary[],
  calendar: [] as Array<{ title: string; startMs: number }>,
  jiraConnected: false,
  googleConnected: false,
  loading: false,
  jiraError: null as string | null,
  gmailError: null as string | null,
  calendarError: null as string | null,
  refresh: mockSideRefresh,
};

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    validateToken: vi.fn(),
    deleteToken: vi.fn(),
  },
}));

vi.mock("@/features/pr/hooks", () => ({
  useMyPRs: (...args: unknown[]) => mockUseMyPRs(...args),
}));

vi.mock("@/features/pr/ci-watch", () => ({
  scanMineCiFailures: (...args: unknown[]) => mockScanMineCiFailures(...args),
}));

vi.mock("@/lib/desktop-alerts", () => ({
  updateDesktopAlerts: (...args: unknown[]) => mockUpdateDesktopAlerts(...args),
}));

vi.mock("@/features/today/useTodaySideData", () => ({
  useTodaySideData: () => mockSideData,
}));

vi.mock("@/features/pr/api", () => ({
  fetchOpenPrsByAuthor: (...args: unknown[]) =>
    mockFetchOpenPrsByAuthor(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import { DashboardPage } from "./dashboard";

const mockValidateToken = vi.mocked(api.validateToken);

const minePr = makePr({ repo: "acme/app", number: 9, title: "Mine PR" });
const reviewPr = makePr({ repo: "acme/app", number: 10, title: "Review me" });

function renderDashboard(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
        <Route path="/metrics" element={<div>Metrics page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    saveSettings({
      ...getSettings(),
      refreshIntervalMin: 0,
      favoritesOnly: false,
      showFavoriteOpen: false,
      showFavoritePeople: false,
    });
    mockNavigate.mockReset();
    mockSideRefresh.mockReset();
    mockFetchOpenPrsByAuthor.mockReset();
    mockSideData.jira = [];
    mockSideData.gmail = [];
    mockSideData.calendar = [];
    mockSideData.jiraConnected = false;
    mockSideData.googleConnected = false;
    mockSideData.loading = false;
    mockSideData.jiraError = null;
    mockSideData.gmailError = null;
    mockSideData.calendarError = null;
    mockValidateToken.mockResolvedValue({
      login: "alice",
      name: "Alice",
      avatar_url: "",
    });
    mockUseMyPRs.mockReturnValue({
      lists: {
        all: [],
        assigned: [],
        review: [reviewPr],
        reviewed: [],
        mine: [minePr],
        favorites: [],
        people: [],
      },
      loading: false,
      error: null,
      updatedAt: new Date("2026-09-04T12:00:00.000Z"),
      refresh: vi.fn(),
    });
    mockScanMineCiFailures.mockResolvedValue([
      {
        pr: minePr,
        description: "build failed",
      },
    ]);
    mockUpdateDesktopAlerts.mockResolvedValue(undefined);
  });

  it("renders greeting, Needs me, and summary cards", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Good (morning|afternoon|evening), Alice/,
        }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "Needs me" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /PRs/ })).toBeInTheDocument();
    expect(screen.getByText("Review me")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("shows CI failure banner and updates desktop alerts", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/have failing CI/)).toBeInTheDocument();
    });
    expect(mockUpdateDesktopAlerts).toHaveBeenCalled();
  });

  it("links to people and repos from page actions", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Good (morning|afternoon|evening), Alice/,
        }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute(
      "href",
      "/people",
    );
    expect(screen.getByRole("link", { name: /Repos/ })).toHaveAttribute(
      "href",
      "/repos",
    );
  });

  it("navigates from CI banner and PR review item", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/have failing CI/)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: `${minePr.repo}#${minePr.number}` }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/9");

    await user.click(screen.getByRole("button", { name: /Review Diff/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/10");
  });

  it("shows already reviewed section and redirects when token invalid", async () => {
    const { saveReviewLocally } = await import("@/lib/settings");
    saveReviewLocally({
      repo: "acme/ghost",
      prNumber: 77,
      prTitle: "Ghost reviewed",
      prUrl: "https://github.com/acme/ghost/pull/77",
      event: "APPROVE",
      summary: "ok",
      body: "ok",
      comments: [],
      branch: "feat/ghost",
    });
    mockUseMyPRs.mockReturnValue({
      lists: {
        all: [],
        favorites: [],
        assigned: [],
        review: [],
        reviewed: [],
        mine: [],
        people: [],
      },
      loading: false,
      error: null,
      updatedAt: new Date("2026-09-04T12:00:00.000Z"),
      refresh: vi.fn(),
    });
    mockScanMineCiFailures.mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Already reviewed/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Ghost reviewed")).toBeInTheDocument();

    mockValidateToken.mockRejectedValueOnce(new Error("bad token"));
    renderDashboard();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
        replace: true,
      });
    });
  });

  it("keeps full PR list on hub=prs", async () => {
    renderDashboard("/?hub=prs");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Pull Requests/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /All open/ })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Already reviewed/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search pull requests" }),
    ).toBeInTheDocument();
  });

  it("filters Needs me by source and shows side preview errors", async () => {
    const user = userEvent.setup();
    mockSideData.jira = [makeJira("TTD-1", "Fix login")];
    mockSideData.gmail = [makeMail("m1", "Please review")];
    mockSideData.jiraConnected = true;
    mockSideData.googleConnected = true;
    mockSideData.calendarError = "Calendar sync failed";
    mockSideData.gmailError = "Gmail sync failed";
    mockSideData.jiraError = "Jira sync failed";

    renderDashboard();
    const needsMe = screen.getByRole("region", { name: "Needs me" });
    await waitFor(() => {
      expect(within(needsMe).getByText("Fix login")).toBeInTheDocument();
    });

    await user.click(within(needsMe).getByRole("tab", { name: /Jira/ }));
    expect(within(needsMe).getByText("Fix login")).toBeInTheDocument();
    expect(within(needsMe).queryByText("Review me")).not.toBeInTheDocument();

    await user.click(within(needsMe).getByRole("tab", { name: /Mail/ }));
    expect(within(needsMe).getByText("Please review")).toBeInTheDocument();

    expect(screen.getByText("Calendar sync failed")).toBeInTheDocument();
    expect(screen.getByText("Jira sync failed")).toBeInTheDocument();
  });

  it("shows People tab on PR hub when enabled and author search results", async () => {
    saveSettings({
      ...getSettings(),
      showFavoritePeople: true,
    });
    mockFetchOpenPrsByAuthor.mockResolvedValue([
      makePr({ repo: "acme/other", number: 88, title: "Author PR" }),
    ]);
    renderDashboard("/?hub=prs&author=carol&by=all");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /People/ })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Author PR")).toBeInTheDocument();
    });
    expect(mockFetchOpenPrsByAuthor).toHaveBeenCalledWith("carol");
  });

  it("clears author filter from PR hub", async () => {
    const user = userEvent.setup();
    renderDashboard("/?hub=prs&author=carol");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /@carol ×/ }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /@carol ×/ }));
    expect(
      screen.queryByRole("button", { name: /@carol ×/ }),
    ).not.toBeInTheDocument();
  });

  it("surfaces author search errors on PR hub", async () => {
    mockFetchOpenPrsByAuthor.mockRejectedValue(new Error("search failed"));
    renderDashboard("/?hub=prs&author=carol&by=all");
    await waitFor(() => {
      expect(screen.getByText(/search failed/)).toBeInTheDocument();
    });
  });

  it("navigates from CI banner on PR hub", async () => {
    const user = userEvent.setup();
    renderDashboard("/?hub=prs");
    await waitFor(() => {
      expect(screen.getByText(/have failing CI/)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: `${minePr.repo}#${minePr.number}` }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/9");
  });

  it("shows repos favorite count on PR hub header", async () => {
    renderDashboard("/?hub=prs");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Repos/ })).toHaveTextContent(
        "9",
      );
    });
  });

  it("shows PR list error on hub and refreshes Today header", async () => {
    const user = userEvent.setup();
    const mockRefresh = vi.fn();
    mockUseMyPRs.mockReturnValue({
      lists: {
        all: [],
        favorites: [],
        assigned: [],
        review: [],
        reviewed: [],
        mine: [],
        people: [],
      },
      loading: false,
      error: "GitHub unavailable",
      updatedAt: null,
      refresh: mockRefresh,
    });
    mockScanMineCiFailures.mockResolvedValue([]);

    const { unmount } = renderDashboard("/?hub=prs");
    await waitFor(() => {
      expect(screen.getByText("GitHub unavailable")).toBeInTheDocument();
    });
    unmount();

    mockUseMyPRs.mockReturnValue({
      lists: {
        all: [],
        favorites: [],
        assigned: [],
        review: [reviewPr],
        reviewed: [],
        mine: [minePr],
        people: [],
      },
      loading: false,
      error: null,
      updatedAt: new Date("2026-09-04T12:00:00.000Z"),
      refresh: mockRefresh,
    });
    renderDashboard();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /Good (morning|afternoon|evening), Alice/,
        }),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockSideRefresh).toHaveBeenCalled();
  });
});
