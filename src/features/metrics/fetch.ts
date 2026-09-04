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

import type {
  DailyActivityPoint,
  EngineerMetricsRaw,
  EnrichedAuthoredPr,
  EnrichedReviewedPr,
  MetricsWindow,
  MetricsWindowPreset,
} from "./types";
import {
  DEFAULT_METRICS_WINDOW,
  METRICS_WINDOW_OPTIONS,
  windowPresetDays,
} from "./types";

function dedupePrs(items: PullRequest[]): PullRequest[] {
  const map = new Map<string, PullRequest>();
  for (const pr of items) {
    map.set(`${pr.repo}#${pr.number}`, pr);
  }
  return [...map.values()];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

function hoursToFirstReview(
  createdAt: string,
  reviews: Awaited<ReturnType<typeof fetchPrReviews>>,
  authorLogin: string,
): number | null {
  const nonAuthor = reviews.reviews.filter(
    (r) => r.user.toLowerCase() !== authorLogin.toLowerCase(),
  );
  const times = nonAuthor
    .map((r) => r.submittedAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  const first = times[0];
  if (!first) return null;
  const a = new Date(createdAt).getTime();
  const b = new Date(first).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, (b - a) / 3_600_000);
}

async function enrichAuthoredPr(
  pr: PullRequest,
  login: string,
  withCi: boolean,
): Promise<EnrichedAuthoredPr> {
  const [detail, reviews, commitCount] = await Promise.all([
    fetchPrDetail(pr),
    fetchPrReviews(pr),
    fetchPrCommitCount(pr),
  ]);

  const nonAuthorReviews = reviews.reviews.filter(
    (r) => r.user.toLowerCase() !== login.toLowerCase(),
  );
  const commentCount =
    reviews.inlineCount +
    reviews.reviews.reduce(
      (sum, r) => sum + r.comments.length + (r.body ? 1 : 0),
      0,
    );

  const mergedAt = detail.mergedAt;

  let ciSnapshot = null;
  if (withCi && detail.headSha) {
    try {
      ciSnapshot = await fetchPrCiChecks(pr, detail.headSha);
    } catch {
      ciSnapshot = null;
    }
  }

  return {
    pr: {
      ...pr,
      state: detail.state,
      headBranch: detail.headBranch,
    },
    mergedAt: mergedAt ?? null,
    additions: detail.additions,
    deletions: detail.deletions,
    changedFiles: detail.changedFiles,
    headSha: detail.headSha,
    commitCount,
    reviewCount: nonAuthorReviews.length,
    commentCount,
    hadReviewBeforeMerge: nonAuthorReviews.length > 0,
    hoursToFirstReview: hoursToFirstReview(pr.createdAt, reviews, login),
    hoursCycleTime: null,
    ciSnapshot,
  };
}

async function enrichReviewedPr(pr: PullRequest): Promise<EnrichedReviewedPr> {
  const reviews = await fetchPrReviews(pr);
  const commentCount =
    reviews.inlineCount +
    reviews.reviews.reduce(
      (sum, r) => sum + r.comments.length + (r.body ? 1 : 0),
      0,
    );
  return {
    pr,
    reviewCount: reviews.reviews.length,
    commentCount,
  };
}

export function buildMetricsWindow(
  preset: MetricsWindowPreset = DEFAULT_METRICS_WINDOW,
): MetricsWindow {
  const to = new Date().toISOString().slice(0, 10);
  const lookback = preset === "today" ? 0 : windowPresetDays(preset);
  const days = windowPresetDays(preset);
  const label =
    METRICS_WINDOW_OPTIONS.find((o) => o.value === preset)?.label ?? preset;
  return {
    from: metricsWindowFrom(lookback),
    to,
    days,
    preset,
    label,
  };
}

export function buildPreviousWindow(current: MetricsWindow): MetricsWindow {
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

function inWindow(iso: string, window: MetricsWindow): boolean {
  const day = iso.slice(0, 10);
  return day >= window.from && day <= window.to;
}

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

export function buildDailyActivity(
  window: MetricsWindow,
  authored: EnrichedAuthoredPr[],
  reviewed: EnrichedReviewedPr[],
): DailyActivityPoint[] {
  const createdBy = new Map<string, number>();
  const mergedBy = new Map<string, number>();
  const reviewedBy = new Map<string, number>();

  for (const item of authored) {
    const created = item.pr.createdAt.slice(0, 10);
    createdBy.set(created, (createdBy.get(created) ?? 0) + 1);
    if (item.mergedAt) {
      const merged = item.mergedAt.slice(0, 10);
      mergedBy.set(merged, (mergedBy.get(merged) ?? 0) + 1);
    }
  }
  for (const item of reviewed) {
    const day = item.pr.updatedAt.slice(0, 10);
    reviewedBy.set(day, (reviewedBy.get(day) ?? 0) + 1);
  }

  return eachDay(window.from, window.to).map((date) => ({
    date,
    created: createdBy.get(date) ?? 0,
    merged: mergedBy.get(date) ?? 0,
    reviewed: reviewedBy.get(date) ?? 0,
  }));
}

export async function fetchEngineerMetrics(
  login: string,
  options?: { preset?: MetricsWindowPreset; withCi?: boolean },
): Promise<{ current: EngineerMetricsRaw; previous: EngineerMetricsRaw }> {
  const preset = options?.preset ?? DEFAULT_METRICS_WINDOW;
  const withCi = options?.withCi ?? true;
  const window = buildMetricsWindow(preset);
  const previousWindow = buildPreviousWindow(window);

  const [authoredRaw, reviewedRaw] = await Promise.all([
    fetchAuthoredPrsInWindow(previousWindow.from),
    fetchReviewedPrsInWindow(previousWindow.from),
  ]);

  const authoredPrs = dedupePrs(authoredRaw);
  const reviewedPrs = dedupePrs(reviewedRaw);

  const [authored, reviewed] = await Promise.all([
    mapWithConcurrency(authoredPrs, 3, (pr) =>
      enrichAuthoredPr(pr, login, withCi && inWindow(pr.createdAt, window)),
    ),
    mapWithConcurrency(reviewedPrs, 3, enrichReviewedPr),
  ]);

  for (const item of authored) {
    if (item.mergedAt) {
      const a = new Date(item.pr.createdAt).getTime();
      const b = new Date(item.mergedAt).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        item.hoursCycleTime = Math.max(0, (b - a) / 3_600_000);
      }
    }
  }

  return {
    current: {
      login,
      window,
      authored: authored.filter((p) => inWindow(p.pr.createdAt, window)),
      reviewed: reviewed.filter((p) => inWindow(p.pr.updatedAt, window)),
    },
    previous: {
      login,
      window: previousWindow,
      authored: authored.filter((p) =>
        inWindow(p.pr.createdAt, previousWindow),
      ),
      reviewed: reviewed.filter((p) =>
        inWindow(p.pr.updatedAt, previousWindow),
      ),
    },
  };
}
