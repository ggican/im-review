import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeWindow } from "@/test/fixtures";

import { CiHealthPanel } from "./CiHealthPanel";
import { MetricBreakdownPanel } from "./MetricBreakdownPanel";
import { MetricCard } from "./MetricCard";
import { MetricsCharts } from "./MetricsCharts";
import { MetricSuggestionsPanel } from "./MetricSuggestionsPanel";
import { MetricSummaryBanner } from "./MetricSummaryBanner";
import type {
  CiHealthSummary,
  MetricsScorecard,
  MetricsSubscore,
  MetricSuggestion,
} from "./types";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

function makeSubscore(
  category: MetricsSubscore["category"],
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

function makeScorecard(overall = 82): MetricsScorecard {
  return {
    overall,
    speed: makeSubscore("speed", "Speed", 80),
    quality: makeSubscore("quality", "Quality", 75),
    throughput: makeSubscore("throughput", "Throughput", 88),
    collaboration: makeSubscore("collaboration", "Collaboration", 70),
    window: makeWindow(7),
    aggregation: "avg",
    generatedAt: "2026-09-04T10:00:00.000Z",
  };
}

const ciSummary: CiHealthSummary = {
  totalChecks: 10,
  passing: 7,
  pending: 1,
  failing: 2,
  passRate: 0.7,
  topFailingContexts: [{ name: "build", count: 2 }],
  latestFailingPrs: [
    {
      repo: "acme/app",
      number: 42,
      title: "Fix CI",
      url: "https://github.com/acme/app/pull/42",
      failedChecks: ["build", "lint"],
      updatedAt: "2026-09-04T12:00:00.000Z",
    },
  ],
  prsWithChecks: 3,
};

const suggestions: MetricSuggestion[] = [
  {
    id: "s1",
    category: "speed",
    priority: "high",
    title: "Review waiting PR",
    reason: "Queue is growing",
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
];

describe("metrics panels", () => {
  it("MetricCard renders score, weight, band, and selects", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MetricCard
        subscore={makeSubscore("speed", "Speed", 85)}
        trend={{ current: 85, previous: 70, pct: 12 }}
        active={false}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Elite")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("MetricSummaryBanner renders overall score and metadata", () => {
    render(
      <MetricSummaryBanner
        overall={82}
        login="alice"
        windowLabel="7 days"
        previousLabel="prior week"
        aggregationLabel="Average"
        generatedAt={new Date("2026-09-04T10:00:00.000Z")}
        trend={{ current: 82, previous: 75, pct: 9 }}
      />,
    );
    expect(screen.getByText("Overall score")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("Elite")).toBeInTheDocument();
    expect(screen.getByText(/@alice/)).toBeInTheDocument();
    expect(screen.getByText(/vs prior week/)).toBeInTheDocument();
  });

  it("MetricBreakdownPanel shows placeholder and populated rows", () => {
    const { rerender } = render(<MetricBreakdownPanel subscore={null} />);
    expect(
      screen.getByText("Select a category to see metric breakdown."),
    ).toBeInTheDocument();

    rerender(
      <MetricBreakdownPanel
        subscore={makeSubscore("quality", "Quality", 72)}
      />,
    );
    expect(screen.getByText("Quality breakdown")).toBeInTheDocument();
    expect(screen.getByText("Cycle time")).toBeInTheDocument();
    expect(screen.getByText("24h")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("MetricCard renders low and medium score bands", () => {
    render(
      <MetricCard
        subscore={makeSubscore("quality", "Quality", 55)}
        trend={null}
        active={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Needs focus")).toBeInTheDocument();
  });

  it("MetricSummaryBanner renders amber and red tones", () => {
    const { rerender } = render(
      <MetricSummaryBanner
        overall={65}
        login={null}
        windowLabel="7 days"
        previousLabel={null}
        aggregationLabel="Average"
        generatedAt={null}
        trend={null}
      />,
    );
    expect(screen.getByText("65")).toBeInTheDocument();

    rerender(
      <MetricSummaryBanner
        overall={45}
        login="bob"
        windowLabel="7 days"
        previousLabel="prior"
        aggregationLabel="Average"
        generatedAt={new Date("2026-09-04T10:00:00.000Z")}
        trend={null}
      />,
    );
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("MetricSuggestionsPanel handles action clicks and icons", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(
      <MemoryRouter>
        <MetricSuggestionsPanel
          suggestions={[
            ...suggestions,
            {
              id: "s2",
              category: "quality",
              priority: "medium",
              title: "Fix CI",
              reason: "Red builds",
              impact: "+2 quality",
              action: "fix_ci",
              actionLabel: "Open PR",
              pr: {
                repo: "acme/app",
                number: 8,
                title: "Broken build",
                url: "https://github.com/acme/app/pull/8",
              },
            },
            {
              id: "s3",
              category: "throughput",
              priority: "low",
              title: "Review queue",
              reason: "Backlog",
              impact: "+1 throughput",
              action: "review",
              actionLabel: "Go to dashboard",
            },
          ]}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getAllByRole("button", { name: "Open PR" })[0]!);
    expect(openUrl).toHaveBeenCalledWith("https://github.com/acme/app/pull/7");
    expect(
      screen.getByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/");
  });

  it("CiHealthPanel opens failing PR links", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(
      <CiHealthPanel
        summary={ciSummary}
        loading={false}
        windowLabel="7 days"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(openUrl).toHaveBeenCalledWith("https://github.com/acme/app/pull/42");
  });

  it("MetricSuggestionsPanel renders empty and populated states", () => {
    const { rerender } = render(<MetricSuggestionsPanel suggestions={[]} />);
    expect(screen.getByText(/No urgent actions right now/)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <MetricSuggestionsPanel suggestions={suggestions} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Review waiting PR")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review in app" })).toHaveAttribute(
      "href",
      "/review/acme/app/7",
    );
  });

  it("CiHealthPanel renders loading, empty checks, and summary stats", () => {
    const { rerender } = render(
      <CiHealthPanel summary={null} loading windowLabel="7 days" />,
    );
    expect(screen.getByText("Loading CI health…")).toBeInTheDocument();

    rerender(
      <CiHealthPanel
        summary={{ ...ciSummary, totalChecks: 0, latestFailingPrs: [] }}
        loading={false}
        windowLabel="7 days"
      />,
    );
    expect(
      screen.getByText(/No CI checks found on authored PRs/),
    ).toBeInTheDocument();

    rerender(
      <CiHealthPanel
        summary={ciSummary}
        loading={false}
        windowLabel="7 days"
      />,
    );
    expect(screen.getByText("Passing")).toBeInTheDocument();
    expect(screen.getByText("build")).toBeInTheDocument();
    expect(screen.getByText(/acme\/app #42/)).toBeInTheDocument();
  });

  it("MetricsCharts renders score comparison and daily activity", () => {
    const current = makeScorecard();
    const previous = makeScorecard(70);
    render(
      <MetricsCharts
        current={current}
        previous={previous}
        daily={[
          { date: "2026-09-01", created: 2, merged: 1, reviewed: 3 },
          { date: "2026-09-02", created: 1, merged: 0, reviewed: 2 },
        ]}
      />,
    );
    expect(screen.getByText("Score vs previous period")).toBeInTheDocument();
    expect(screen.getByText("Daily activity")).toBeInTheDocument();
    expect(screen.getByLabelText("Daily PR activity")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
  });

  it("MetricsCharts shows empty activity message", () => {
    render(
      <MetricsCharts current={makeScorecard()} previous={null} daily={[]} />,
    );
    expect(screen.getByText("No activity in this window.")).toBeInTheDocument();
  });
});
