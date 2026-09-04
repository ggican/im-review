import { describe, expect, it } from "vitest";

import { makeAuthored, makePr, makeRaw, makeWindow } from "@/test/fixtures";

import { computeScorecard } from "./score";
import { buildMetricSuggestions } from "./suggestions";

const oldCreated = "2026-08-01T00:00:00.000Z";

describe("UNIT-METRICS-015 review suggestions", () => {
  it("suggests reviewing when collab low and queue non-empty", () => {
    const raw = makeRaw({ window: makeWindow(7), authored: [], reviewed: [] });
    const scorecard = computeScorecard(raw);
    scorecard.collaboration.score = 40;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [
        makePr({ repo: "acme/web", number: 11, title: "Needs review" }),
        makePr({ repo: "acme/api", number: 12 }),
      ],
      myOpenPrs: [],
    });

    expect(suggestions.some((s) => s.action === "review")).toBe(true);
    expect(suggestions.some((s) => s.id.startsWith("review-"))).toBe(true);
  });

  it("UNIT-METRICS-022 suggests finding reviews when queue empty", () => {
    const raw = makeRaw();
    const scorecard = computeScorecard(raw);
    scorecard.collaboration.score = 40;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [],
    });

    expect(suggestions.some((s) => s.id === "collab-find-reviews")).toBe(true);
  });
});

describe("UNIT-METRICS-016/019 quality suggestions", () => {
  it("suggests splitting oversized open PRs", () => {
    const big = makeAuthored({
      pr: makePr({
        repo: "acme/web",
        number: 22,
        title: "Huge PR",
        state: "open",
        createdAt: oldCreated,
      }),
      mergedAt: null,
      additions: 900,
      deletions: 200,
      reviewCount: 1,
      hadReviewBeforeMerge: true,
    });
    const raw = makeRaw({ authored: [big] });
    const scorecard = computeScorecard(raw);
    scorecard.quality.score = 35;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [big.pr],
    });

    expect(suggestions.some((s) => s.action === "split")).toBe(true);
  });

  it("suggests requesting review on unreviewed open PRs", () => {
    // Fresh PR (<24h) so aging merge/follow_up path does not claim it first.
    const open = makeAuthored({
      pr: makePr({
        repo: "acme/web",
        number: 33,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      mergedAt: null,
      additions: 50,
      deletions: 5,
      reviewCount: 0,
      hadReviewBeforeMerge: false,
    });
    const raw = makeRaw({ authored: [open] });
    const scorecard = computeScorecard(raw);
    scorecard.quality.score = 40;
    scorecard.speed.score = 90;
    scorecard.throughput.score = 90;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [open.pr],
    });

    expect(suggestions.some((s) => s.id.startsWith("need-review-"))).toBe(true);
  });
});

describe("UNIT-METRICS-017/018 aging PR suggestions", () => {
  it("suggests fix_ci for aging PR with failed CI", () => {
    const open = makeAuthored({
      pr: makePr({
        repo: "acme/web",
        number: 44,
        createdAt: oldCreated,
      }),
      mergedAt: null,
      reviewCount: 1,
      hadReviewBeforeMerge: true,
      ciSnapshot: {
        overall: "failure",
        sha: "x",
        items: [
          {
            id: "1",
            name: "ci",
            state: "failure",
            description: "fail",
            targetUrl: null,
            source: "status",
            updatedAt: null,
          },
        ],
        failedCount: 1,
        pendingCount: 0,
        successCount: 0,
      },
    });
    const raw = makeRaw({ authored: [open] });
    const scorecard = computeScorecard(raw);
    scorecard.speed.score = 50;
    scorecard.throughput.score = 50;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [open.pr],
    });

    expect(suggestions.some((s) => s.action === "fix_ci")).toBe(true);
  });

  it("suggests merge for reviewed aging open PR", () => {
    const open = makeAuthored({
      pr: makePr({
        repo: "acme/web",
        number: 55,
        createdAt: oldCreated,
      }),
      mergedAt: null,
      reviewCount: 2,
      hadReviewBeforeMerge: true,
      ciSnapshot: null,
    });
    const raw = makeRaw({ authored: [open] });
    const scorecard = computeScorecard(raw);
    scorecard.speed.score = 50;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [open.pr],
    });

    expect(suggestions.some((s) => s.action === "merge")).toBe(true);
  });

  it("suggests follow_up when aging open PR lacks review", () => {
    const open = makeAuthored({
      pr: makePr({
        repo: "acme/web",
        number: 56,
        createdAt: oldCreated,
      }),
      mergedAt: null,
      reviewCount: 0,
      hadReviewBeforeMerge: false,
      additions: 20,
      deletions: 2,
    });
    const raw = makeRaw({ authored: [open] });
    const scorecard = computeScorecard(raw);
    scorecard.speed.score = 50;
    scorecard.quality.score = 90; // avoid split/need-review noise

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [open.pr],
    });

    expect(suggestions.some((s) => s.action === "follow_up")).toBe(true);
  });
});

describe("UNIT-METRICS-020/021 throughput + cap", () => {
  it("suggests shipping when throughput thin", () => {
    const raw = makeRaw({ authored: [], reviewed: [] });
    const scorecard = computeScorecard(raw);
    scorecard.throughput.score = 40;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested: [],
      myOpenPrs: [],
    });

    expect(suggestions.some((s) => s.id === "throughput-ship")).toBe(true);
  });

  it("caps at 8 suggestions", () => {
    const reviewRequested = Array.from({ length: 12 }, (_, i) =>
      makePr({ repo: "acme/web", number: 100 + i }),
    );
    const raw = makeRaw({ authored: [], reviewed: [] });
    const scorecard = computeScorecard(raw);
    scorecard.collaboration.score = 20;

    const suggestions = buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested,
      myOpenPrs: [],
    });

    expect(suggestions.length).toBeLessThanOrEqual(8);
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
