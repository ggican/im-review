import { cn } from "@/lib/cn";

import { DeltaBadge, scoreBand } from "./DeltaBadge";
import type { ScoreTrend } from "./types";

function scoreTone(score: number): string {
  if (score >= 80) {
    return "border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
  }
  if (score >= 60) {
    return "border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  }
  return "border-red-200 bg-red-50/60 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200";
}

export function MetricSummaryBanner({
  overall,
  login,
  windowLabel,
  previousLabel,
  aggregationLabel,
  generatedAt,
  trend,
}: {
  overall: number;
  login: string | null;
  windowLabel: string;
  previousLabel: string | null;
  aggregationLabel: string;
  generatedAt: Date | null;
  trend: ScoreTrend | null;
}) {
  return (
    <section className={cn("rounded-lg border px-5 py-6", scoreTone(overall))}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide uppercase opacity-80">
            Overall score
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {overall}
            </span>
            <span className="text-sm opacity-80">/ 100</span>
            <DeltaBadge trend={trend} />
            <span className="rounded-md border border-neutral-400/40 px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
              {scoreBand(overall)}
            </span>
          </div>
          <p className="mt-2 text-xs opacity-80">
            {login ? `@${login}` : "…"} · {aggregationLabel} · {windowLabel}
            {previousLabel ? ` vs ${previousLabel}` : ""}
            {generatedAt
              ? ` · updated ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </p>
        </div>
        <div className="text-xs opacity-80">
          <div>25% Speed</div>
          <div>40% Throughput</div>
          <div>15% Quality</div>
          <div>20% Collaboration</div>
        </div>
      </div>
    </section>
  );
}
