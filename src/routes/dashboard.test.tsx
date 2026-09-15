import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSettings, saveSettings } from "@/lib/settings";
import { makePr } from "@/test/fixtures";

const mockNavigate = vi.fn();
const mockUseMyPRs = vi.fn();
const mockScanMineCiFailures = vi.fn();
const mockUpdateDesktopAlerts = vi.fn();
const mockSideRefresh = vi.fn();

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
  useTodaySideData: () => ({
    jira: [],
    gmail: [],
    calendar: [],
    jiraConnected: false,
    googleConnected: false,
    loading: false,
    jiraError: null,
    gmailError: null,
    calendarError: null,
    refresh: mockSideRefresh,
  }),
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
        screen.getByRole("heading", { name: /Good (morning|afternoon|evening), Alice/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Needs me" })).toBeInTheDocument();
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
        screen.getByRole("heading", { name: /Good (morning|afternoon|evening), Alice/ }),
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
});
