import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthored, makePr, makeWindow } from "@/test/fixtures";

vi.mock("@/features/pr/api", () => ({
  fetchAuthoredPrsInWindow: vi.fn(),
  fetchPrCiChecks: vi.fn(),
  fetchPrCommitCount: vi.fn(),
  fetchPrDetail: vi.fn(),
  fetchPrReviews: vi.fn(),
  fetchReviewedPrsInWindow: vi.fn(),
  metricsWindowFrom: vi.fn(),
}));

import {
  fetchAuthoredPrsInWindow,
  fetchPrCiChecks,
  fetchPrCommitCount,
  fetchPrDetail,
  fetchPrReviews,
  fetchReviewedPrsInWindow,
  metricsWindowFrom,
} from "@/features/pr/api";
import type { PullRequest } from "@/features/pr/types";

import {
  buildDailyActivity,
  buildMetricsWindow,
  buildPreviousWindow,
  fetchEngineerMetrics,
} from "./fetch";

const mockFetchAuthored = vi.mocked(fetchAuthoredPrsInWindow);
const mockFetchReviewed = vi.mocked(fetchReviewedPrsInWindow);
const mockFetchDetail = vi.mocked(fetchPrDetail);
const mockFetchReviews = vi.mocked(fetchPrReviews);
const mockFetchCommitCount = vi.mocked(fetchPrCommitCount);
const mockFetchCi = vi.mocked(fetchPrCiChecks);
const mockMetricsWindowFrom = vi.mocked(metricsWindowFrom);

const FIXED_NOW = new Date("2026-09-04T12:00:00.000Z");

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function expectedPreviousWindow(current: ReturnType<typeof makeWindow>) {
  const from = new Date(`${current.from}T00:00:00`);
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - current.days + 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    from: iso(prevFrom),
    to: iso(prevTo),
    days: current.days,
    preset: current.preset,
    label: `Previous ${current.label.toLowerCase()}`,
  };
}

function emptyReviews() {
  return { reviews: [], latestByUser: [], inlineCount: 0 };
}

function reviewsWith(
  items: Array<{
    user: string;
    submittedAt: string | null;
    body?: string;
    comments?: Array<{ body: string }>;
  }>,
  inlineCount = 0,
) {
  return {
    reviews: items.map((item, idx) => ({
      id: idx + 1,
      user: item.user,
      avatarUrl: "",
      state: "APPROVED",
      body: item.body ?? "",
      submittedAt: item.submittedAt,
      htmlUrl: "u",
      comments: (item.comments ?? []).map((c, cidx) => ({
        id: cidx,
        path: "a.ts",
        line: 1,
        body: c.body,
        user: item.user,
        avatarUrl: "",
        createdAt: item.submittedAt ?? "",
        htmlUrl: "u",
        reviewId: idx + 1,
      })),
    })),
    latestByUser: [],
    inlineCount,
  };
}

function mockDetail(
  pr: PullRequest,
  overrides: {
    mergedAt?: string | null;
    headSha?: string;
    state?: PullRequest["state"];
    additions?: number;
    deletions?: number;
    changedFiles?: number;
  } = {},
) {
  return {
    ...pr,
    body: "",
    nodeId: `PR_${pr.number}`,
    mergedAt: overrides.mergedAt ?? null,
    headSha: overrides.headSha ?? "sha-head",
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 2,
    changedFiles: overrides.changedFiles ?? 1,
    reviewers: [],
    ciStatus: "success" as const,
    ciDescription: "ok",
    state: overrides.state ?? pr.state,
    headBranch: pr.headBranch ?? "feat/x",
  };
}

function ciSnapshot() {
  return {
    overall: "success" as const,
    sha: "sha-head",
    items: [
      {
        id: "1",
        name: "ci",
        state: "success" as const,
        description: "ok",
        targetUrl: null,
        source: "status" as const,
        updatedAt: null,
      },
    ],
    failedCount: 0,
    pendingCount: 0,
    successCount: 1,
  };
}

function setupEnrichmentMocks() {
  mockFetchDetail.mockImplementation(async (pr) => mockDetail(pr));
  mockFetchReviews.mockResolvedValue(emptyReviews());
  mockFetchCommitCount.mockResolvedValue(3);
  mockFetchCi.mockResolvedValue(ciSnapshot());
}

describe("UNIT-METRICS-020 buildMetricsWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockMetricsWindowFrom.mockImplementation((days = 7) => {
      const from = new Date(FIXED_NOW);
      from.setDate(from.getDate() - days);
      return from.toISOString().slice(0, 10);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds default 7-day window", () => {
    const window = buildMetricsWindow();

    expect(window).toEqual({
      from: "2026-08-28",
      to: "2026-09-04",
      days: 7,
      preset: "7",
      label: "7 days",
    });
    expect(mockMetricsWindowFrom).toHaveBeenCalledWith(7);
  });

  it("uses lookback 0 for today preset", () => {
    const window = buildMetricsWindow("today");

    expect(window.preset).toBe("today");
    expect(window.days).toBe(1);
    expect(window.label).toBe("Today");
    expect(mockMetricsWindowFrom).toHaveBeenCalledWith(0);
  });

  it("supports 14- and 30-day presets", () => {
    const w14 = buildMetricsWindow("14");
    const w30 = buildMetricsWindow("30");

    expect(w14.days).toBe(14);
    expect(w14.label).toBe("14 days");
    expect(mockMetricsWindowFrom).toHaveBeenCalledWith(14);

    expect(w30.days).toBe(30);
    expect(w30.label).toBe("30 days");
    expect(mockMetricsWindowFrom).toHaveBeenCalledWith(30);
  });
});

describe("UNIT-METRICS-021 buildPreviousWindow", () => {
  it("shifts window back by current span", () => {
    const current = makeWindow(7);
    const previous = buildPreviousWindow(current);

    expect(previous).toEqual(expectedPreviousWindow(current));
  });

  it("handles single-day windows", () => {
    const current = makeWindow(1);
    const previous = buildPreviousWindow(current);

    expect(previous).toEqual(expectedPreviousWindow(current));
  });
});

describe("UNIT-METRICS-022 buildDailyActivity", () => {
  it("aggregates created, merged, and reviewed counts per day", () => {
    const window = {
      from: "2026-09-01",
      to: "2026-09-04",
      days: 4,
      preset: "7" as const,
      label: "4 days",
    };

    const authored = [
      makeAuthored({
        pr: makePr({
          repo: "acme/web",
          number: 1,
          createdAt: "2026-09-01T10:00:00.000Z",
        }),
        mergedAt: "2026-09-02T18:00:00.000Z",
      }),
      makeAuthored({
        pr: makePr({
          repo: "acme/web",
          number: 2,
          createdAt: "2026-09-01T14:00:00.000Z",
        }),
        mergedAt: null,
      }),
    ];

    const reviewed = [
      {
        pr: makePr({
          repo: "acme/api",
          number: 9,
          updatedAt: "2026-09-03T08:00:00.000Z",
        }),
        reviewCount: 1,
        commentCount: 0,
      },
    ];

    const activity = buildDailyActivity(window, authored, reviewed);

    expect(activity.map((d) => d.date)).toEqual(
      eachDay(window.from, window.to),
    );
    expect(activity.reduce((sum, d) => sum + d.created, 0)).toBe(2);
    expect(activity.reduce((sum, d) => sum + d.merged, 0)).toBe(1);
    expect(activity.reduce((sum, d) => sum + d.reviewed, 0)).toBe(1);
    expect(
      activity.find((d) => d.date === "2026-09-01")?.created,
    ).toBe(2);
    expect(
      activity.find((d) => d.date === "2026-09-02")?.merged,
    ).toBe(1);
    expect(
      activity.find((d) => d.date === "2026-09-03")?.reviewed,
    ).toBe(1);
  });

  it("returns zero-filled days when there is no activity", () => {
    const window = {
      from: "2026-09-01",
      to: "2026-09-04",
      days: 4,
      preset: "7" as const,
      label: "4 days",
    };
    const activity = buildDailyActivity(window, [], []);

    expect(activity).toHaveLength(4);
    expect(activity.every((d) => d.created === 0 && d.merged === 0)).toBe(
      true,
    );
  });
});

describe("UNIT-METRICS-023 fetchEngineerMetrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    mockMetricsWindowFrom.mockReturnValue("2026-08-28");
    mockFetchAuthored.mockResolvedValue([]);
    mockFetchReviewed.mockResolvedValue([]);
    setupEnrichmentMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("fetches from previous-window start and partitions current vs previous", async () => {
    const currentPr = makePr({
      repo: "acme/web",
      number: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
    const previousPr = makePr({
      repo: "acme/web",
      number: 2,
      createdAt: "2026-08-25T10:00:00.000Z",
      updatedAt: "2026-08-25T12:00:00.000Z",
    });
    const stalePr = makePr({
      repo: "acme/web",
      number: 3,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T12:00:00.000Z",
    });
    const reviewedCurrent = makePr({
      repo: "acme/api",
      number: 10,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-09-02T08:00:00.000Z",
    });
    const reviewedPrevious = makePr({
      repo: "acme/api",
      number: 11,
      createdAt: "2026-08-20T10:00:00.000Z",
      updatedAt: "2026-08-24T08:00:00.000Z",
    });

    mockFetchAuthored.mockResolvedValue([currentPr, previousPr, stalePr]);
    mockFetchReviewed.mockResolvedValue([reviewedCurrent, reviewedPrevious]);

    const { current, previous } = await fetchEngineerMetrics("alice");
    const expectedFetchFrom = buildPreviousWindow(
      buildMetricsWindow("7"),
    ).from;

    expect(mockFetchAuthored).toHaveBeenCalledWith(expectedFetchFrom);
    expect(mockFetchReviewed).toHaveBeenCalledWith(expectedFetchFrom);

    expect(current.login).toBe("alice");
    expect(current.window.to).toBe("2026-09-04");
    expect(current.authored.map((a) => a.pr.number)).toEqual([1]);
    expect(current.reviewed.map((r) => r.pr.number)).toEqual([10]);

    expect(previous.window).toEqual(
      expectedPreviousWindow(buildMetricsWindow("7")),
    );
    expect(previous.authored.map((a) => a.pr.number)).toEqual([2]);
    expect(previous.reviewed.map((r) => r.pr.number)).toEqual([11]);
  });

  it("dedupes authored and reviewed PR lists", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 5,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr, { ...pr }]);
    mockFetchReviewed.mockResolvedValue([pr, { ...pr }]);

    const { current } = await fetchEngineerMetrics("alice");

    expect(current.authored).toHaveLength(1);
    expect(current.reviewed).toHaveLength(1);
    expect(mockFetchDetail).toHaveBeenCalledTimes(1);
    expect(mockFetchReviews).toHaveBeenCalledTimes(2);
  });

  it("computes cycle time when PR is merged", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 7,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr]);
    mockFetchDetail.mockResolvedValue(
      mockDetail(pr, { mergedAt: "2026-09-03T00:00:00.000Z" }),
    );

    const { current } = await fetchEngineerMetrics("alice");

    expect(current.authored[0]?.hoursCycleTime).toBe(48);
    expect(current.authored[0]?.mergedAt).toBe("2026-09-03T00:00:00.000Z");
  });

  it("leaves cycle time null when PR is not merged", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 8,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr]);
    mockFetchDetail.mockResolvedValue(mockDetail(pr, { mergedAt: null }));

    const { current } = await fetchEngineerMetrics("alice");

    expect(current.authored[0]?.hoursCycleTime).toBeNull();
  });

  it("fetches CI only for current-window authored PRs when withCi is true", async () => {
    const currentPr = makePr({
      repo: "acme/web",
      number: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    const previousPr = makePr({
      repo: "acme/web",
      number: 2,
      createdAt: "2026-08-25T10:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([currentPr, previousPr]);

    const { current, previous } = await fetchEngineerMetrics("alice", {
      withCi: true,
    });

    expect(mockFetchCi).toHaveBeenCalledTimes(1);
    expect(mockFetchCi).toHaveBeenCalledWith(currentPr, "sha-head");
    expect(current.authored[0]?.ciSnapshot).not.toBeNull();
    expect(previous.authored[0]?.ciSnapshot).toBeNull();
  });

  it("skips CI when withCi is false", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr]);

    const { current } = await fetchEngineerMetrics("alice", { withCi: false });

    expect(mockFetchCi).not.toHaveBeenCalled();
    expect(current.authored[0]?.ciSnapshot).toBeNull();
  });

  it("ignores CI failures and returns null snapshot", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr]);
    mockFetchCi.mockRejectedValue(new Error("ci down"));

    const { current } = await fetchEngineerMetrics("alice", { withCi: true });

    expect(current.authored[0]?.ciSnapshot).toBeNull();
  });

  it("enriches review metrics and hours to first non-author review", async () => {
    const pr = makePr({
      repo: "acme/web",
      number: 12,
      author: { login: "alice", avatarUrl: "" },
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    mockFetchAuthored.mockResolvedValue([pr]);
    mockFetchReviews.mockResolvedValue(
      reviewsWith(
        [
          {
            user: "alice",
            submittedAt: "2026-09-01T06:00:00.000Z",
            body: "self",
          },
          {
            user: "bob",
            submittedAt: "2026-09-01T12:00:00.000Z",
            body: "lgtm",
            comments: [{ body: "nit" }],
          },
        ],
        2,
      ),
    );

    const { current } = await fetchEngineerMetrics("alice");

    const enriched = current.authored[0]!;
    expect(enriched.reviewCount).toBe(1);
    expect(enriched.commentCount).toBe(5);
    expect(enriched.hadReviewBeforeMerge).toBe(true);
    expect(enriched.hoursToFirstReview).toBe(12);
    expect(enriched.commitCount).toBe(3);
  });

  it("enriches reviewed PR comment counts", async () => {
    const pr = makePr({
      repo: "acme/api",
      number: 20,
      updatedAt: "2026-09-02T08:00:00.000Z",
    });
    mockFetchReviewed.mockResolvedValue([pr]);
    mockFetchReviews.mockResolvedValue(
      reviewsWith(
        [
          { user: "alice", submittedAt: "2026-09-02T09:00:00.000Z" },
          { user: "carol", submittedAt: "2026-09-02T10:00:00.000Z", body: "ok" },
        ],
        1,
      ),
    );

    const { current } = await fetchEngineerMetrics("alice");

    expect(current.reviewed[0]?.reviewCount).toBe(2);
    expect(current.reviewed[0]?.commentCount).toBe(2);
  });
});
