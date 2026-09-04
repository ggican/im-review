import type { CiChecksSnapshot, PullRequest } from "@/features/pr/types";

export type MetricsWindowPreset = "today" | "7" | "14" | "30";

export const DEFAULT_METRICS_WINDOW: MetricsWindowPreset = "7";

export const METRICS_WINDOW_OPTIONS: Array<{
  value: MetricsWindowPreset;
  label: string;
}> = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

export function windowPresetDays(preset: MetricsWindowPreset): number {
  return preset === "today" ? 1 : Number(preset);
}

export type MetricsWindow = {
  from: string;
  to: string;
  days: number;
  preset: MetricsWindowPreset;
  label: string;
};

export type MetricKey =
  | "cycleTime"
  | "cycleTimeVariance"
  | "codingTime"
  | "unreviewedRate"
  | "prSize"
  | "postPrCommits"
  | "prCreationRate"
  | "mergeRate"
  | "codingDays"
  | "locChanges"
  | "timeToFirstReview"
  | "prsReviewed"
  | "commentsPerPr";

export type MetricCategory =
  "speed" | "quality" | "throughput" | "collaboration";

export type MetricDrilldownRow = {
  key: MetricKey;
  label: string;
  rawValue: string;
  score: number;
  hint?: string;
};

export type MetricsSubscore = {
  category: MetricCategory;
  label: string;
  score: number;
  weight: number;
  metrics: MetricDrilldownRow[];
};

export type MetricsAggregation = "p50" | "p75" | "p90" | "p95" | "p99" | "avg";

export const DEFAULT_METRICS_AGGREGATION: MetricsAggregation = "avg";

export const METRICS_AGGREGATION_OPTIONS: Array<{
  value: MetricsAggregation;
  label: string;
}> = [
  { value: "p50", label: "50th Percentile" },
  { value: "p75", label: "75th Percentile" },
  { value: "p90", label: "90th Percentile" },
  { value: "p95", label: "95th Percentile" },
  { value: "p99", label: "99th Percentile" },
  { value: "avg", label: "Average" },
];

export type ScoreTrend = {
  current: number;
  previous: number | null;
  pct: number | null;
};

export type MetricsTrends = {
  overall: ScoreTrend;
  speed: ScoreTrend;
  quality: ScoreTrend;
  throughput: ScoreTrend;
  collaboration: ScoreTrend;
};

export type DailyActivityPoint = {
  date: string;
  created: number;
  merged: number;
  reviewed: number;
};

export type MetricsScorecard = {
  overall: number;
  speed: MetricsSubscore;
  quality: MetricsSubscore;
  throughput: MetricsSubscore;
  collaboration: MetricsSubscore;
  window: MetricsWindow;
  aggregation: MetricsAggregation;
  generatedAt: string;
};

export type EnrichedAuthoredPr = {
  pr: PullRequest;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  headSha: string;
  commitCount: number;
  reviewCount: number;
  commentCount: number;
  hadReviewBeforeMerge: boolean;
  hoursToFirstReview: number | null;
  hoursCycleTime: number | null;
  ciSnapshot: CiChecksSnapshot | null;
};

export type EnrichedReviewedPr = {
  pr: PullRequest;
  reviewCount: number;
  commentCount: number;
};

export type EngineerMetricsRaw = {
  login: string;
  window: MetricsWindow;
  authored: EnrichedAuthoredPr[];
  reviewed: EnrichedReviewedPr[];
};

export type FailingPrRef = {
  repo: string;
  number: number;
  title: string;
  url: string;
  failedChecks: string[];
  updatedAt: string;
};

export type CiHealthSummary = {
  totalChecks: number;
  passing: number;
  pending: number;
  failing: number;
  passRate: number;
  topFailingContexts: Array<{ name: string; count: number }>;
  latestFailingPrs: FailingPrRef[];
  prsWithChecks: number;
};

export type MetricSuggestionAction =
  "review" | "merge" | "fix_ci" | "split" | "follow_up";

export type MetricSuggestion = {
  id: string;
  category: MetricCategory;
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  impact: string;
  action: MetricSuggestionAction;
  actionLabel: string;
  pr?: {
    repo: string;
    number: number;
    title: string;
    url: string;
  };
};
