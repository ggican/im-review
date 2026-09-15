import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/cn";

import type { ScoreTrend } from "./types";

export function DeltaBadge({
  trend,
  className,
}: {
  trend: ScoreTrend | null | undefined;
  className?: string;
}) {
  if (!trend || trend.pct == null) {
    return (
      <span className={cn("text-body-sm text-on-surface-variant", className)}>
        —
      </span>
    );
  }

  const up = trend.pct > 0.5;
  const down = trend.pct < -0.5;
  const label = `${up ? "+" : ""}${trend.pct.toFixed(0)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-body-sm font-medium",
        up && "text-success",
        down && "text-error",
        !up && !down && "text-on-surface-variant",
        className,
      )}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : null}
      {down ? <TrendingDown className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

export function scoreBand(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 60) return "On track";
  return "Needs focus";
}
