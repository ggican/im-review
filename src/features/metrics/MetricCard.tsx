import { cn } from "@/lib/cn";

import { DeltaBadge, scoreBand } from "./DeltaBadge";
import type { MetricsSubscore, ScoreTrend } from "./types";

function barClass(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function MetricCard({
  subscore,
  trend,
  active,
  onSelect,
}: {
  subscore: MetricsSubscore;
  trend?: ScoreTrend | null;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        active
          ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900"
          : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            {subscore.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900 tabular-nums dark:text-neutral-50">
            {subscore.score}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-neutral-400">
            {Math.round(subscore.weight * 100)}%
          </span>
          <div className="mt-1">
            <DeltaBadge trend={trend} />
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={cn("h-full rounded-full", barClass(subscore.score))}
          style={{ width: `${subscore.score}%` }}
        />
      </div>
      <p className="mt-2 text-xs tracking-wide text-neutral-400 uppercase">
        {scoreBand(subscore.score)}
      </p>
    </button>
  );
}
