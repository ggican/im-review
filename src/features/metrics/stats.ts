import type { MetricsAggregation, ScoreTrend } from "./types";

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export function aggregate(
  values: number[],
  mode: MetricsAggregation,
): number | null {
  if (values.length === 0) return null;
  if (mode === "avg") return average(values);
  const sorted = [...values].sort((a, b) => a - b);
  const p =
    mode === "p50"
      ? 0.5
      : mode === "p75"
        ? 0.75
        : mode === "p90"
          ? 0.9
          : mode === "p95"
            ? 0.95
            : 0.99;
  return percentile(sorted, p);
}

export function aggregationLabel(mode: MetricsAggregation): string {
  switch (mode) {
    case "avg":
      return "avg";
    case "p50":
      return "p50";
    case "p75":
      return "p75";
    case "p90":
      return "p90";
    case "p95":
      return "p95";
    case "p99":
      return "p99";
  }
}

export function scoreTrend(
  current: number,
  previous: number | null,
): ScoreTrend {
  if (previous == null) {
    return { current, previous: null, pct: null };
  }
  if (previous === 0) {
    return {
      current,
      previous,
      pct: current === 0 ? 0 : 100,
    };
  }
  return {
    current,
    previous,
    pct: ((current - previous) / previous) * 100,
  };
}
