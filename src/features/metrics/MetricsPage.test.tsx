import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeWindow } from "@/test/fixtures";

import type { MetricCategory, MetricsScorecard, MetricsSubscore, ScoreTrend } from "./types";

const mockRefresh = vi.fn();
const mockUseMetrics = vi.fn();

vi.mock("./hooks", () => ({
  useMetrics: (...args: unknown[]) => mockUseMetrics(...args),
}));

import { MetricsPage } from "./MetricsPage";

function makeSubscore(
  category: MetricCategory,
  label: string,
  score: number,
): MetricsSubscore {
  return {
    category,
    label,
    score,
    weight: 0.25,
    metrics: [
      {
        key: "cycleTime",
        label: "Cycle time",
        rawValue: "24h",
        score,
        hint: "Lower is better",
      },
    ],
  };
}

const trend: ScoreTrend = { current: 82, previous: 75, pct: 9 };

const scorecard: MetricsScorecard = {
  overall: 82,
  speed: makeSubscore("speed", "Speed", 80),
  quality: makeSubscore("quality", "Quality", 75),
  throughput: makeSubscore("throughput", "Throughput", 88),
  collaboration: makeSubscore("collaboration", "Collaboration", 70),
  window: makeWindow(7),
  aggregation: "avg",
  generatedAt: "2026-09-04T10:00:00.000Z",
};

function renderMetricsPage() {
  return render(
    <MemoryRouter>
      <MetricsPage />
    </MemoryRouter>,
  );
}

describe("MetricsPage", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUseMetrics.mockReturnValue({
      scorecard,
      previousScorecard: { ...scorecard, overall: 70 },
      trends: {
        overall: trend,
        speed: trend,
        quality: trend,
        throughput: trend,
        collaboration: trend,
      },
      daily: [{ date: "2026-09-01", created: 2, merged: 1, reviewed: 3 }],
      suggestions: [
        {
          id: "s1",
          category: "speed",
          priority: "high",
          title: "Review waiting PR",
          reason: "Queue growing",
          impact: "+3 speed",
          action: "review",
          actionLabel: "Open PR",
          pr: {
            repo: "acme/app",
            number: 7,
            title: "Feature",
            url: "https://github.com/acme/app/pull/7",
          },
        },
      ],
      ciHealth: {
        totalChecks: 10,
        passing: 7,
        pending: 1,
        failing: 2,
        passRate: 0.7,
        topFailingContexts: [{ name: "build", count: 2 }],
        latestFailingPrs: [],
        prsWithChecks: 3,
      },
      login: "alice",
      loading: false,
      error: null,
      updatedAt: new Date("2026-09-04T10:00:00.000Z"),
      refresh: mockRefresh,
    });
  });

  it("renders scorecard tab with category cards and breakdown", async () => {
    const user = userEvent.setup();
    renderMetricsPage();

    expect(screen.getByRole("heading", { name: "Metrics" })).toBeInTheDocument();
    expect(screen.getByText("Overall score")).toBeInTheDocument();
    expect(screen.getByText("Speed breakdown")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Quality/ }));
    expect(screen.getByText("Quality breakdown")).toBeInTheDocument();
  });

  it("switches to suggestions and CI tabs and refreshes", async () => {
    const user = userEvent.setup();
    renderMetricsPage();

    await user.click(screen.getByRole("tab", { name: /Suggestions \(1\)/ }));
    expect(screen.getByText("Review waiting PR")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "CI Health" }));
    expect(screen.getAllByText("CI Health").length).toBeGreaterThan(0);
    expect(screen.getByText("Passing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("changes aggregation and time window presets", async () => {
    const user = userEvent.setup();
    renderMetricsPage();

    await user.click(screen.getByRole("button", { name: "14 days" }));
    await user.click(screen.getByRole("button", { name: "30 days" }));

    expect(mockUseMetrics).toHaveBeenCalled();
  });

  it("shows loading, error, and empty states", async () => {
    mockUseMetrics.mockReturnValue({
      scorecard: null,
      previousScorecard: null,
      trends: null,
      daily: [],
      suggestions: [],
      ciHealth: null,
      login: null,
      loading: true,
      error: null,
      updatedAt: null,
      refresh: mockRefresh,
    });
    const { rerender } = renderMetricsPage();
    expect(screen.getByText(/Computing metrics from GitHub/)).toBeInTheDocument();

    mockUseMetrics.mockReturnValue({
      scorecard: null,
      previousScorecard: null,
      trends: null,
      daily: [],
      suggestions: [],
      ciHealth: null,
      login: null,
      loading: false,
      error: "Metrics failed",
      updatedAt: null,
      refresh: mockRefresh,
    });
    rerender(
      <MemoryRouter>
        <MetricsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Metrics failed")).toBeInTheDocument();

    mockUseMetrics.mockReturnValue({
      scorecard: null,
      previousScorecard: null,
      trends: null,
      daily: [],
      suggestions: [],
      ciHealth: null,
      login: null,
      loading: false,
      error: null,
      updatedAt: null,
      refresh: mockRefresh,
    });
    rerender(
      <MemoryRouter>
        <MetricsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("No metrics available yet.")).toBeInTheDocument();
    });
  });
});
