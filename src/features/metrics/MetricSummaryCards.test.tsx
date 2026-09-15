import { describe, expect, it } from "vitest";

import { makeWindow } from "@/test/fixtures";

import { buildMetricSummaryItems } from "./MetricSummaryCards";
import type {
  CiHealthSummary,
  MetricsScorecard,
  MetricsSubscore,
} from "./types";

function makeSubscore(
  category: MetricsSubscore["category"],
  label: string,
  score: number,
  metrics: MetricsSubscore["metrics"] = [],
): MetricsSubscore {
  return {
    category,
    label,
    score,
    weight: 0.25,
    metrics:
      metrics.length > 0
        ? metrics
        : [
            {
              key: "cycleTime",
              label: "Cycle time",
              rawValue: "24h",
              score,
            },
          ],
  };
}

function makeScorecard(): MetricsScorecard {
  return {
    overall: 82,
    speed: makeSubscore("speed", "Speed", 80),
    quality: makeSubscore("quality", "Quality", 75, [
      {
        key: "unreviewedRate",
        label: "Unreviewed PR rate",
        rawValue: "20%",
        score: 65,
      },
    ]),
    throughput: makeSubscore("throughput", "Throughput", 88),
    collaboration: makeSubscore("collaboration", "Collaboration", 70, [
      {
        key: "timeToFirstReview",
        label: "Time to first review",
        rawValue: "6.0h avg",
        score: 85,
      },
      {
        key: "prsReviewed",
        label: "PRs reviewed",
        rawValue: "12 (12.0 / week)",
        score: 85,
      },
    ]),
    window: makeWindow(7),
    aggregation: "avg",
    generatedAt: "2026-09-04T10:00:00.000Z",
  };
}

const ciHealth: CiHealthSummary = {
  totalChecks: 10,
  passing: 7,
  pending: 1,
  failing: 2,
  passRate: 0.7,
  topFailingContexts: [],
  latestFailingPrs: [],
  prsWithChecks: 3,
};

describe("buildMetricSummaryItems", () => {
  it("maps available scorecard and CI fields into summary cards", () => {
    const items = buildMetricSummaryItems(makeScorecard(), ciHealth);
    expect(items.find((i) => i.id === "prs-reviewed")).toMatchObject({
      value: "12",
      available: true,
    });
    expect(items.find((i) => i.id === "avg-review-time")).toMatchObject({
      value: "6.0h avg",
      available: true,
    });
    expect(items.find((i) => i.id === "review-coverage")).toMatchObject({
      value: "80%",
      available: true,
    });
    expect(items.find((i) => i.id === "ci-health")).toMatchObject({
      value: "70% pass",
      available: true,
      tone: "warning",
    });
  });

  it("marks missing drilldowns and empty CI as unavailable", () => {
    const empty: MetricsScorecard = {
      ...makeScorecard(),
      quality: makeSubscore("quality", "Quality", 50, [
        {
          key: "unreviewedRate",
          label: "Unreviewed PR rate",
          rawValue: "—",
          score: 50,
        },
      ]),
      collaboration: makeSubscore("collaboration", "Collaboration", 50, [
        {
          key: "timeToFirstReview",
          label: "Time to first review",
          rawValue: "—",
          score: 50,
        },
        {
          key: "prsReviewed",
          label: "PRs reviewed",
          rawValue: "0 (0.0 / week)",
          score: 25,
        },
      ]),
    };
    const items = buildMetricSummaryItems(empty, {
      ...ciHealth,
      totalChecks: 0,
      passRate: 0,
    });
    expect(items.find((i) => i.id === "prs-reviewed")).toMatchObject({
      value: "0",
      available: true,
    });
    expect(items.find((i) => i.id === "avg-review-time")?.available).toBe(
      false,
    );
    expect(items.find((i) => i.id === "review-coverage")?.available).toBe(
      false,
    );
    expect(items.find((i) => i.id === "ci-health")).toMatchObject({
      value: "Unavailable",
      available: false,
    });
  });
});
