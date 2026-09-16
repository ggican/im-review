import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

import type {
  CiHealthSummary,
  MetricDrilldownRow,
  MetricKey,
  MetricsScorecard,
} from "./types";

function findMetric(
  scorecard: MetricsScorecard,
  key: MetricKey,
): MetricDrilldownRow | null {
  const pools = [
    scorecard.speed.metrics,
    scorecard.quality.metrics,
    scorecard.throughput.metrics,
    scorecard.collaboration.metrics,
  ];
  for (const pool of pools) {
    const hit = pool.find((m) => m.key === key);
    if (hit) return hit;
  }
  return null;
}

function isUnavailable(rawValue: string | undefined | null): boolean {
  return rawValue == null || rawValue.trim() === "" || rawValue.trim() === "—";
}

/** Inverse of unreviewed rate when that metric is available. */
function reviewCoverageLabel(unreviewed: MetricDrilldownRow | null): {
  value: string;
  available: boolean;
} {
  if (!unreviewed || isUnavailable(unreviewed.rawValue)) {
    return { value: "Unavailable", available: false };
  }
  const match = unreviewed.rawValue.match(/^(\d+(?:\.\d+)?)%/);
  if (!match) return { value: "Unavailable", available: false };
  const rate = Number(match[1]);
  if (!Number.isFinite(rate)) return { value: "Unavailable", available: false };
  return {
    value: `${Math.max(0, Math.min(100, 100 - rate)).toFixed(0)}%`,
    available: true,
  };
}

type SummaryItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  available: boolean;
  tone?: "success" | "warning" | "error" | "neutral";
};

export function buildMetricSummaryItems(
  scorecard: MetricsScorecard,
  ciHealth: CiHealthSummary | null,
): SummaryItem[] {
  const reviewed = findMetric(scorecard, "prsReviewed");
  const reviewTime = findMetric(scorecard, "timeToFirstReview");
  const unreviewed = findMetric(scorecard, "unreviewedRate");
  const coverage = reviewCoverageLabel(unreviewed);

  const reviewedAvailable =
    Boolean(reviewed) && !isUnavailable(reviewed?.rawValue);
  const reviewTimeAvailable =
    Boolean(reviewTime) && !isUnavailable(reviewTime?.rawValue);

  let ciValue = "Unavailable";
  let ciAvailable = false;
  let ciTone: SummaryItem["tone"] = "neutral";
  if (ciHealth && ciHealth.totalChecks > 0) {
    ciAvailable = true;
    const pct = Math.round(ciHealth.passRate * 100);
    ciValue = `${pct}% pass`;
    if (pct >= 80) ciTone = "success";
    else if (pct >= 60) ciTone = "warning";
    else ciTone = "error";
  }

  return [
    {
      id: "prs-reviewed",
      label: "Pull requests reviewed",
      value: reviewedAvailable
        ? (reviewed!.rawValue.split(" ")[0] ?? reviewed!.rawValue)
        : "Unavailable",
      hint: reviewedAvailable
        ? reviewed!.rawValue
        : "No review activity in this window",
      available: reviewedAvailable,
      tone: reviewedAvailable ? "neutral" : "neutral",
    },
    {
      id: "avg-review-time",
      label: "Average review time",
      value: reviewTimeAvailable ? reviewTime!.rawValue : "Unavailable",
      hint: reviewTimeAvailable
        ? (reviewTime!.hint ?? "Time to first review on authored PRs")
        : "Not enough review timing samples",
      available: reviewTimeAvailable,
    },
    {
      id: "review-coverage",
      label: "Review response rate",
      value: coverage.value,
      hint: coverage.available
        ? "Merged PRs that received a review (1 − unreviewed rate)"
        : "Needs merged PRs in this window",
      available: coverage.available,
      tone: coverage.available ? "neutral" : "neutral",
    },
    {
      id: "ci-health",
      label: "CI health",
      value: ciValue,
      hint: ciAvailable
        ? `${ciHealth!.passing} passing · ${ciHealth!.failing} failing · ${ciHealth!.pending} pending`
        : "No CI checks on authored PRs",
      available: ciAvailable,
      tone: ciTone,
    },
  ];
}

export function MetricSummaryCards({
  scorecard,
  ciHealth,
}: {
  scorecard: MetricsScorecard;
  ciHealth: CiHealthSummary | null;
}) {
  const items = buildMetricSummaryItems(scorecard, ciHealth);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.id}
          padding="default"
          className={cn(
            item.tone === "success" && "border-success/30",
            item.tone === "warning" && "border-warning/30",
            item.tone === "error" && "border-error/30",
            !item.available && "border-dashed",
          )}
        >
          <CardHeader className="mb-1">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle
              className={cn(
                "font-headline text-headline-sm tabular-nums",
                !item.available && "text-on-surface-variant",
                item.tone === "success" && "text-success",
                item.tone === "warning" && "text-warning",
                item.tone === "error" && "text-error",
              )}
            >
              {item.value}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-body-sm text-on-surface-variant">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
