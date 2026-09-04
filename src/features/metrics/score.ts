import { aggregate, aggregationLabel, average, scoreTrend } from "./stats";
import type {
  CiHealthSummary,
  EngineerMetricsRaw,
  EnrichedAuthoredPr,
  FailingPrRef,
  MetricCategory,
  MetricDrilldownRow,
  MetricsAggregation,
  MetricsScorecard,
  MetricsSubscore,
  MetricsTrends,
} from "./types";
import { DEFAULT_METRICS_AGGREGATION } from "./types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = average(nums);
  const variance =
    nums.reduce((sum, n) => sum + (n - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function scoreLowerIsBetter(
  value: number | null,
  bands: Array<{ max: number; score: number }>,
  emptyScore = 50,
): number {
  if (value == null || Number.isNaN(value)) return emptyScore;
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1]?.score ?? emptyScore;
}

function scoreHigherIsBetter(
  value: number,
  bands: Array<{ min: number; score: number }>,
  emptyScore = 50,
): number {
  if (value <= 0) return emptyScore;
  for (let i = bands.length - 1; i >= 0; i -= 1) {
    if (value >= bands[i]!.min) return bands[i]!.score;
  }
  return bands[0]?.score ?? emptyScore;
}

function scoreRangeIsBest(
  value: number,
  idealMin: number,
  idealMax: number,
  emptyScore = 50,
): number {
  if (value <= 0) return emptyScore;
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < idealMin) {
    return clamp(50 + (value / idealMin) * 50);
  }
  const over = value - idealMax;
  const penalty = Math.min(70, (over / idealMax) * 70);
  return clamp(100 - penalty);
}

function metric(
  key: MetricDrilldownRow["key"],
  label: string,
  rawValue: string,
  score: number,
  hint?: string,
): MetricDrilldownRow {
  return { key, label, rawValue, score: clamp(score), hint };
}

function fmtHours(value: number | null, mode: MetricsAggregation): string {
  if (value == null) return "—";
  return `${value.toFixed(1)}h ${aggregationLabel(mode)}`;
}

function buildSpeedMetrics(
  authored: EnrichedAuthoredPr[],
  mode: MetricsAggregation,
): MetricDrilldownRow[] {
  const merged = authored.filter((p) => p.mergedAt && p.hoursCycleTime != null);
  const cycleTimes = merged.map((p) => p.hoursCycleTime!);
  const cycleValue = aggregate(cycleTimes, mode);

  const meanCycle = average(cycleTimes);
  const cv =
    cycleTimes.length < 2 || meanCycle === 0
      ? null
      : stdDev(cycleTimes) / meanCycle;

  const codingTimes = authored
    .map((p) => p.hoursToFirstReview)
    .filter((h): h is number => h != null);
  const codingValue = aggregate(codingTimes, mode);

  return [
    metric(
      "cycleTime",
      "Cycle time",
      fmtHours(cycleValue, mode),
      scoreLowerIsBetter(cycleValue, [
        { max: 24, score: 100 },
        { max: 48, score: 85 },
        { max: 72, score: 70 },
        { max: 120, score: 55 },
        { max: 168, score: 40 },
        { max: Infinity, score: 25 },
      ]),
      "Created → merged",
    ),
    metric(
      "cycleTimeVariance",
      "Cycle time variance",
      cv == null ? "—" : `CV ${(cv * 100).toFixed(0)}%`,
      scoreLowerIsBetter(cv, [
        { max: 0.2, score: 100 },
        { max: 0.4, score: 80 },
        { max: 0.6, score: 60 },
        { max: 0.8, score: 40 },
        { max: Infinity, score: 25 },
      ]),
      "Lower variance = steadier delivery",
    ),
    metric(
      "codingTime",
      "Coding time",
      fmtHours(codingValue, mode),
      scoreLowerIsBetter(codingValue, [
        { max: 12, score: 100 },
        { max: 24, score: 85 },
        { max: 48, score: 70 },
        { max: 72, score: 50 },
        { max: Infinity, score: 30 },
      ]),
      "Created → first review",
    ),
  ];
}

function buildQualityMetrics(
  authored: EnrichedAuthoredPr[],
  mode: MetricsAggregation,
): MetricDrilldownRow[] {
  const merged = authored.filter((p) => p.mergedAt);
  const unreviewed = merged.filter((p) => !p.hadReviewBeforeMerge);
  const unreviewedRate =
    merged.length === 0 ? null : unreviewed.length / merged.length;

  const sizes = authored.map((p) => p.additions + p.deletions);
  const sizeValue = aggregate(sizes, mode);

  const commitValue = aggregate(
    authored.map((p) => p.commitCount),
    mode,
  );

  return [
    metric(
      "unreviewedRate",
      "Unreviewed PR rate",
      unreviewedRate == null ? "—" : `${(unreviewedRate * 100).toFixed(0)}%`,
      scoreLowerIsBetter(unreviewedRate == null ? null : unreviewedRate * 100, [
        { max: 0, score: 100 },
        { max: 10, score: 85 },
        { max: 25, score: 65 },
        { max: 50, score: 40 },
        { max: Infinity, score: 20 },
      ]),
      "Merged without any review",
    ),
    metric(
      "prSize",
      "PR size",
      sizeValue == null
        ? "—"
        : `${Math.round(sizeValue)} LOC ${aggregationLabel(mode)}`,
      scoreLowerIsBetter(sizeValue, [
        { max: 100, score: 100 },
        { max: 250, score: 85 },
        { max: 500, score: 70 },
        { max: 1000, score: 50 },
        { max: Infinity, score: 30 },
      ]),
      "Additions + deletions",
    ),
    metric(
      "postPrCommits",
      "Post-PR commits",
      commitValue == null
        ? "—"
        : `${commitValue.toFixed(1)} ${aggregationLabel(mode)}`,
      scoreLowerIsBetter(commitValue, [
        { max: 2, score: 100 },
        { max: 4, score: 85 },
        { max: 8, score: 65 },
        { max: 15, score: 45 },
        { max: Infinity, score: 25 },
      ]),
      "Commits on PR branch",
    ),
  ];
}

function buildThroughputMetrics(
  authored: EnrichedAuthoredPr[],
  windowDays: number,
): MetricDrilldownRow[] {
  const weeks = windowDays / 7;
  const creationRate = authored.length / weeks;
  const mergedCount = authored.filter((p) => p.mergedAt).length;
  const mergeRate = authored.length === 0 ? 0 : mergedCount / authored.length;

  const codingDays = new Set<string>();
  for (const p of authored) {
    codingDays.add(p.pr.createdAt.slice(0, 10));
    if (p.mergedAt) codingDays.add(p.mergedAt.slice(0, 10));
  }

  const totalLoc = authored.reduce(
    (sum, p) => sum + p.additions + p.deletions,
    0,
  );
  const locPerWeek = totalLoc / weeks;

  return [
    metric(
      "prCreationRate",
      "PR creation rate",
      `${creationRate.toFixed(1)} / week`,
      scoreHigherIsBetter(
        creationRate,
        [
          { min: 5, score: 100 },
          { min: 3, score: 85 },
          { min: 2, score: 70 },
          { min: 1, score: 55 },
          { min: 0.1, score: 40 },
        ],
        20,
      ),
    ),
    metric(
      "mergeRate",
      "Merge rate",
      authored.length === 0 ? "—" : `${(mergeRate * 100).toFixed(0)}%`,
      scoreHigherIsBetter(
        mergeRate * 100,
        [
          { min: 90, score: 100 },
          { min: 75, score: 85 },
          { min: 60, score: 70 },
          { min: 40, score: 50 },
          { min: 1, score: 30 },
        ],
        30,
      ),
    ),
    metric(
      "codingDays",
      "Coding days",
      `${codingDays.size} days`,
      scoreHigherIsBetter(
        codingDays.size,
        [
          { min: 15, score: 100 },
          { min: 10, score: 85 },
          { min: 7, score: 70 },
          { min: 4, score: 50 },
          { min: 1, score: 30 },
        ],
        20,
      ),
    ),
    metric(
      "locChanges",
      "LOC changes",
      `${Math.round(locPerWeek)} / week`,
      scoreRangeIsBest(locPerWeek, 200, 2000),
      "Total additions + deletions",
    ),
  ];
}

function buildCollaborationMetrics(
  reviewedCount: number,
  authored: EnrichedAuthoredPr[],
  windowDays: number,
  mode: MetricsAggregation,
): MetricDrilldownRow[] {
  const weeks = windowDays / 7;
  const reviewTimes = authored
    .map((p) => p.hoursToFirstReview)
    .filter((h): h is number => h != null);
  const ttfr = aggregate(reviewTimes, mode);

  const comments = authored.map((p) => p.commentCount);
  const commentsValue = aggregate(comments, mode);

  return [
    metric(
      "timeToFirstReview",
      "Time to first review",
      fmtHours(ttfr, mode),
      scoreLowerIsBetter(ttfr, [
        { max: 4, score: 100 },
        { max: 12, score: 85 },
        { max: 24, score: 70 },
        { max: 48, score: 50 },
        { max: Infinity, score: 30 },
      ]),
      "On your authored PRs",
    ),
    metric(
      "prsReviewed",
      "PRs reviewed",
      `${reviewedCount} (${(reviewedCount / weeks).toFixed(1)} / week)`,
      scoreHigherIsBetter(
        reviewedCount,
        [
          { min: 20, score: 100 },
          { min: 12, score: 85 },
          { min: 8, score: 70 },
          { min: 4, score: 55 },
          { min: 1, score: 35 },
        ],
        25,
      ),
    ),
    metric(
      "commentsPerPr",
      "Comments per PR",
      commentsValue == null
        ? "—"
        : `${commentsValue.toFixed(1)} ${aggregationLabel(mode)}`,
      scoreHigherIsBetter(
        commentsValue ?? 0,
        [
          { min: 5, score: 100 },
          { min: 3, score: 85 },
          { min: 2, score: 70 },
          { min: 1, score: 50 },
          { min: 0.1, score: 30 },
        ],
        40,
      ),
      "Inline + review comments on your PRs",
    ),
  ];
}

function subscore(
  category: MetricCategory,
  label: string,
  weight: number,
  metrics: MetricDrilldownRow[],
): MetricsSubscore {
  const score =
    metrics.length === 0 ? 50 : clamp(average(metrics.map((m) => m.score)));
  return { category, label, score, weight, metrics };
}

export function computeScorecard(
  raw: EngineerMetricsRaw,
  aggregation: MetricsAggregation = DEFAULT_METRICS_AGGREGATION,
): MetricsScorecard {
  const speedMetrics = buildSpeedMetrics(raw.authored, aggregation);
  const qualityMetrics = buildQualityMetrics(raw.authored, aggregation);
  const throughputMetrics = buildThroughputMetrics(
    raw.authored,
    raw.window.days,
  );
  const collaborationMetrics = buildCollaborationMetrics(
    raw.reviewed.length,
    raw.authored,
    raw.window.days,
    aggregation,
  );

  const speed = subscore("speed", "Speed", 0.25, speedMetrics);
  const quality = subscore("quality", "Quality", 0.15, qualityMetrics);
  const throughput = subscore(
    "throughput",
    "Throughput",
    0.4,
    throughputMetrics,
  );
  const collaboration = subscore(
    "collaboration",
    "Collaboration",
    0.2,
    collaborationMetrics,
  );

  const overall = clamp(
    speed.score * 0.25 +
      throughput.score * 0.4 +
      quality.score * 0.15 +
      collaboration.score * 0.2,
  );

  return {
    overall,
    speed,
    quality,
    throughput,
    collaboration,
    window: raw.window,
    aggregation,
    generatedAt: new Date().toISOString(),
  };
}

export function computeTrends(
  current: MetricsScorecard,
  previous: MetricsScorecard | null,
): MetricsTrends {
  return {
    overall: scoreTrend(current.overall, previous?.overall ?? null),
    speed: scoreTrend(current.speed.score, previous?.speed.score ?? null),
    quality: scoreTrend(current.quality.score, previous?.quality.score ?? null),
    throughput: scoreTrend(
      current.throughput.score,
      previous?.throughput.score ?? null,
    ),
    collaboration: scoreTrend(
      current.collaboration.score,
      previous?.collaboration.score ?? null,
    ),
  };
}

export function buildCiHealthSummary(
  authored: EnrichedAuthoredPr[],
): CiHealthSummary {
  let passing = 0;
  let pending = 0;
  let failing = 0;
  const contextFails = new Map<string, number>();
  const failingPrs: FailingPrRef[] = [];

  for (const item of authored) {
    const snap = item.ciSnapshot;
    if (!snap || snap.items.length === 0) continue;

    for (const check of snap.items) {
      if (check.state === "success") passing += 1;
      else if (check.state === "pending") pending += 1;
      else if (check.state === "failure") {
        failing += 1;
        contextFails.set(check.name, (contextFails.get(check.name) ?? 0) + 1);
      }
    }

    const failedNames = snap.items
      .filter((c) => c.state === "failure")
      .map((c) => c.name);
    if (failedNames.length > 0) {
      failingPrs.push({
        repo: item.pr.repo,
        number: item.pr.number,
        title: item.pr.title,
        url: item.pr.url,
        failedChecks: failedNames,
        updatedAt: item.pr.updatedAt,
      });
    }
  }

  const totalChecks = passing + pending + failing;
  const topFailingContexts = [...contextFails.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const latestFailingPrs = failingPrs
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  const prsWithChecks = authored.filter(
    (p) => p.ciSnapshot && p.ciSnapshot.items.length > 0,
  ).length;

  return {
    totalChecks,
    passing,
    pending,
    failing,
    passRate: totalChecks === 0 ? 0 : passing / totalChecks,
    topFailingContexts,
    latestFailingPrs,
    prsWithChecks,
  };
}

export { DEFAULT_METRICS_WINDOW } from "./types";
