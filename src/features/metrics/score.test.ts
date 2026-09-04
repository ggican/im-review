import { describe, expect, it } from "vitest";

import { makeAuthored, makePr, makeRaw, makeWindow } from "@/test/fixtures";

import { buildCiHealthSummary, computeScorecard, computeTrends } from "./score";

function ciSnap(
  items: Array<{ name: string; state: "success" | "failure" | "pending" }>,
) {
  return {
    overall: items.some((i) => i.state === "failure")
      ? ("failure" as const)
      : items.some((i) => i.state === "pending")
        ? ("pending" as const)
        : ("success" as const),
    sha: "abc",
    items: items.map((i, idx) => ({
      id: String(idx),
      name: i.name,
      state: i.state,
      description: i.state,
      targetUrl: null,
      source: "status" as const,
      updatedAt: null,
    })),
    failedCount: items.filter((i) => i.state === "failure").length,
    pendingCount: items.filter((i) => i.state === "pending").length,
    successCount: items.filter((i) => i.state === "success").length,
  };
}

describe("UNIT-METRICS-006/007 computeScorecard", () => {
  it("returns bounded overall with correct weights", () => {
    const card = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 1 }),
            mergedAt: "2026-09-02T12:00:00.000Z",
            hoursCycleTime: 20,
            hoursToFirstReview: 6,
            hadReviewBeforeMerge: true,
          }),
        ],
        reviewed: [
          {
            pr: makePr({ repo: "acme/api", number: 9 }),
            reviewCount: 1,
            commentCount: 2,
          },
        ],
        window: makeWindow(7),
      }),
      "avg",
    );
    expect(card.overall).toBeGreaterThanOrEqual(0);
    expect(card.overall).toBeLessThanOrEqual(100);
    expect(card.speed.weight).toBe(0.25);
    expect(card.throughput.weight).toBe(0.4);
    expect(card.quality.weight).toBe(0.15);
    expect(card.collaboration.weight).toBe(0.2);
  });

  it("handles empty authored/reviewed", () => {
    const card = computeScorecard(makeRaw(), "p75");
    expect(card.overall).toBeGreaterThanOrEqual(0);
    expect(card.speed.metrics.length).toBeGreaterThan(0);
  });
});

describe("UNIT-METRICS-008/009/010 scoring bands", () => {
  it("fast cycle scores better than slow", () => {
    const fast = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 1 }),
            mergedAt: "2026-09-02T00:00:00.000Z",
            hoursCycleTime: 10,
            hoursToFirstReview: 4,
          }),
        ],
      }),
    );
    const slow = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 2 }),
            mergedAt: "2026-09-02T00:00:00.000Z",
            hoursCycleTime: 200,
            hoursToFirstReview: 100,
          }),
        ],
      }),
    );
    expect(fast.speed.score).toBeGreaterThan(slow.speed.score);
  });

  it("unreviewed merges score worse quality", () => {
    const reviewed = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 1 }),
            mergedAt: "2026-09-02T00:00:00.000Z",
            hadReviewBeforeMerge: true,
            additions: 50,
            deletions: 10,
          }),
        ],
      }),
    );
    const unreviewed = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 2 }),
            mergedAt: "2026-09-02T00:00:00.000Z",
            hadReviewBeforeMerge: false,
            additions: 50,
            deletions: 10,
          }),
        ],
      }),
    );
    expect(reviewed.quality.score).toBeGreaterThan(unreviewed.quality.score);
  });

  it("oversized PRs score worse than small", () => {
    const small = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 1 }),
            additions: 40,
            deletions: 10,
          }),
        ],
      }),
    );
    const huge = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 2 }),
            additions: 2000,
            deletions: 500,
          }),
        ],
      }),
    );
    const smallSize = small.quality.metrics.find((m) => m.key === "prSize")!;
    const hugeSize = huge.quality.metrics.find((m) => m.key === "prSize")!;
    expect(smallSize.score).toBeGreaterThan(hugeSize.score);
  });
});

describe("UNIT-METRICS-011 computeTrends", () => {
  it("compares all categories", () => {
    const current = computeScorecard(
      makeRaw({
        authored: [
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: 1 }),
            mergedAt: "2026-09-02T12:00:00.000Z",
            hoursCycleTime: 12,
          }),
        ],
      }),
    );
    const previous = computeScorecard(makeRaw());
    const trends = computeTrends(current, previous);
    expect(trends.overall.current).toBe(current.overall);
    expect(trends.speed.previous).toBe(previous.speed.score);
    expect(trends.quality.current).toBe(current.quality.score);
    expect(trends.throughput.current).toBe(current.throughput.score);
    expect(trends.collaboration.current).toBe(current.collaboration.score);
  });

  it("handles null previous scorecard", () => {
    const current = computeScorecard(makeRaw());
    const trends = computeTrends(current, null);
    expect(trends.overall.previous).toBeNull();
    expect(trends.overall.pct).toBeNull();
  });
});

describe("UNIT-METRICS-012/013 buildCiHealthSummary", () => {
  it("summarizes failing checks and sorts", () => {
    const summary = buildCiHealthSummary([
      makeAuthored({
        pr: makePr({
          repo: "acme/web",
          number: 3,
          title: "Fix CI",
          updatedAt: "2026-09-03T00:00:00.000Z",
        }),
        ciSnapshot: ciSnap([
          { name: "jenkins/build", state: "failure" },
          { name: "lint", state: "success" },
          { name: "tests", state: "pending" },
        ]),
      }),
      makeAuthored({
        pr: makePr({
          repo: "acme/web",
          number: 4,
          updatedAt: "2026-09-04T00:00:00.000Z",
        }),
        ciSnapshot: ciSnap([{ name: "jenkins/build", state: "failure" }]),
      }),
      makeAuthored({
        pr: makePr({ repo: "acme/web", number: 5 }),
        ciSnapshot: null,
      }),
      makeAuthored({
        pr: makePr({ repo: "acme/web", number: 6 }),
        ciSnapshot: ciSnap([]),
      }),
    ]);

    expect(summary.failing).toBe(2);
    expect(summary.passing).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.latestFailingPrs[0]?.number).toBe(4);
    expect(summary.topFailingContexts[0]?.name).toBe("jenkins/build");
    expect(summary.topFailingContexts[0]?.count).toBe(2);
    expect(summary.prsWithChecks).toBe(2);
  });

  it("returns zero passRate when no checks", () => {
    expect(buildCiHealthSummary([]).passRate).toBe(0);
  });
});

describe("UNIT-METRICS-023/024 aggregation + variance", () => {
  it("p90 can differ from avg on skewed cycles", () => {
    const authored = [10, 12, 14, 16, 200].map((hours, i) =>
      makeAuthored({
        pr: makePr({ repo: "acme/web", number: i + 1 }),
        mergedAt: "2026-09-02T00:00:00.000Z",
        hoursCycleTime: hours,
        hoursToFirstReview: hours / 2,
      }),
    );
    const avg = computeScorecard(makeRaw({ authored }), "avg");
    const p90 = computeScorecard(makeRaw({ authored }), "p90");
    const avgCycle = avg.speed.metrics.find((m) => m.key === "cycleTime")!;
    const p90Cycle = p90.speed.metrics.find((m) => m.key === "cycleTime")!;
    expect(avgCycle.rawValue).not.toBe(p90Cycle.rawValue);
  });

  it("computes cycle variance with multiple merges", () => {
    const card = computeScorecard(
      makeRaw({
        authored: [20, 40, 60, 80].map((h, i) =>
          makeAuthored({
            pr: makePr({ repo: "acme/web", number: i + 1 }),
            mergedAt: "2026-09-02T00:00:00.000Z",
            hoursCycleTime: h,
          }),
        ),
      }),
    );
    const cv = card.speed.metrics.find((m) => m.key === "cycleTimeVariance")!;
    expect(cv.rawValue).not.toBe("—");
  });
});
