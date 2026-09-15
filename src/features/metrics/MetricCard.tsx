import { cn } from "@/lib/cn";

import { DeltaBadge, scoreBand } from "./DeltaBadge";
import type { MetricsSubscore, ScoreTrend } from "./types";

function barClass(score: number): string {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-error";
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
        "rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-primary-container bg-stream-github/60 shadow-sm"
          : "border-border bg-surface-container-lowest hover:bg-surface-container-low/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-label-sm tracking-wide text-on-surface-variant uppercase">
            {subscore.label}
          </p>
          <p className="mt-1 font-headline text-headline-md text-on-surface tabular-nums">
            {subscore.score}
          </p>
        </div>
        <div className="text-right">
          <span className="font-keycap text-body-sm text-on-surface-variant">
            {Math.round(subscore.weight * 100)}%
          </span>
          <div className="mt-1">
            <DeltaBadge trend={trend} />
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={cn("h-full rounded-full", barClass(subscore.score))}
          style={{ width: `${subscore.score}%` }}
        />
      </div>
      <p className="mt-2 text-label-sm tracking-wide text-on-surface-variant uppercase">
        {scoreBand(subscore.score)}
      </p>
    </button>
  );
}
