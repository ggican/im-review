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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import { DashboardPage } from "./dashboard";

const mockValidateToken = vi.mocked(api.validateToken);
const mockDeleteToken = vi.mocked(api.deleteToken);

const minePr = makePr({ repo: "acme/app", number: 9, title: "Mine PR" });
const reviewPr = makePr({ repo: "acme/app", number: 10, title: "Review me" });

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
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
    });
    mockNavigate.mockReset();
    mockValidateToken.mockResolvedValue({
      login: "alice",
      name: "Alice",
      avatar_url: "",
    });
    mockDeleteToken.mockResolvedValue(undefined);
    mockUseMyPRs.mockReturnValue({
      lists: { assigned: [], review: [reviewPr], mine: [minePr] },
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

  it("renders user header and PR list tabs", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText(/@alice/)).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Review requested/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Review me")).toBeInTheDocument();
  });

  it("shows CI failure banner and updates desktop alerts", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/have failing CI/)).toBeInTheDocument();
    });
    expect(mockUpdateDesktopAlerts).toHaveBeenCalled();
  });

  it("navigates to metrics from header", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("link", { name: /Metrics/ }));
    expect(screen.getByText("Metrics page")).toBeInTheDocument();
  });

  it("navigates from CI banner and PR list, toggles favorites, and signs out", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/have failing CI/)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: `${minePr.repo}#${minePr.number}` }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/9");

    await user.click(screen.getByRole("button", { name: /Review me/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/10");

    await user.click(screen.getByRole("button", { name: /Favorites/ }));
    expect(getSettings().favoritesOnly).toBe(true);

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(mockDeleteToken).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });

  it("keeps locally reviewed PRs and redirects when token invalid", async () => {
    const { saveReviewLocally, getSettings, saveSettings } =
      await import("@/lib/settings");
    saveSettings({ ...getSettings(), favoritesOnly: false });
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
      lists: { assigned: [], review: [], mine: [] },
      loading: false,
      error: null,
      updatedAt: new Date("2026-09-04T12:00:00.000Z"),
      refresh: vi.fn(),
    });
    mockScanMineCiFailures.mockResolvedValue([]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Ghost reviewed")).toBeInTheDocument();
    });

    mockValidateToken.mockRejectedValueOnce(new Error("bad token"));
    renderDashboard();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", {
        replace: true,
      });
    });
  });
});
