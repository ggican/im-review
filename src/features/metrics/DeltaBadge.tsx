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
    return <span className={cn("text-xs text-neutral-400", className)}>—</span>;
  }

  const up = trend.pct > 0.5;
  const down = trend.pct < -0.5;
  const label = `${up ? "+" : ""}${trend.pct.toFixed(0)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up && "text-emerald-700 dark:text-emerald-400",
        down && "text-red-700 dark:text-red-400",
        !up && !down && "text-neutral-500",
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
