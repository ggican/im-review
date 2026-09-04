import type {
  EngineerMetricsRaw,
  EnrichedAuthoredPr,
  MetricsWindow,
} from "@/features/metrics/types";
import type { PullRequest } from "@/features/pr/types";

export function makePr(
  overrides: Partial<PullRequest> & Pick<PullRequest, "number" | "repo">,
): PullRequest {
  const number = overrides.number;
  const repo = overrides.repo;
  return {
    id: overrides.id ?? number,
    number,
    repo,
    title: overrides.title ?? `PR ${number}`,
    url: overrides.url ?? `https://github.com/${repo}/pull/${number}`,
    state: overrides.state ?? "open",
    author: overrides.author ?? { login: "alice", avatarUrl: "" },
    isDraft: overrides.isDraft ?? false,
    updatedAt: overrides.updatedAt ?? "2026-09-01T12:00:00.000Z",
    createdAt: overrides.createdAt ?? "2026-09-01T10:00:00.000Z",
    headBranch: overrides.headBranch,
    localReviewEvent: overrides.localReviewEvent,
    fromLocalReview: overrides.fromLocalReview,
  };
}

export function makeWindow(days = 7): MetricsWindow {
  return {
    from: "2026-08-28",
    to: "2026-09-04",
    days,
    preset: days === 1 ? "today" : days === 7 ? "7" : days === 14 ? "14" : "30",
    label: days === 1 ? "Today" : `${days} days`,
  };
}

export function makeAuthored(
  overrides: Partial<EnrichedAuthoredPr> & { pr: PullRequest },
): EnrichedAuthoredPr {
  return {
    pr: overrides.pr,
    mergedAt: overrides.mergedAt ?? null,
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 2,
    changedFiles: overrides.changedFiles ?? 1,
    headSha: overrides.headSha ?? "abc",
    commitCount: overrides.commitCount ?? 3,
    reviewCount: overrides.reviewCount ?? 1,
    commentCount: overrides.commentCount ?? 0,
    hadReviewBeforeMerge: overrides.hadReviewBeforeMerge ?? true,
    hoursToFirstReview: overrides.hoursToFirstReview ?? 8,
    hoursCycleTime: overrides.hoursCycleTime ?? 24,
    ciSnapshot: overrides.ciSnapshot ?? null,
  };
}

export function makeRaw(
  overrides: Partial<EngineerMetricsRaw> = {},
): EngineerMetricsRaw {
  return {
    login: overrides.login ?? "alice",
    window: overrides.window ?? makeWindow(7),
    authored: overrides.authored ?? [],
    reviewed: overrides.reviewed ?? [],
  };
}
