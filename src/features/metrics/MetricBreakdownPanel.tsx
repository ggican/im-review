import type { MetricsSubscore } from "./types";

function scoreClass(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function MetricBreakdownPanel({
  subscore,
}: {
  subscore: MetricsSubscore | null;
}) {
  if (!subscore) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">
          Select a category to see metric breakdown.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{subscore.label} breakdown</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Raw values shown next to each normalized score (0–100).
        </p>
      </div>
      <ul className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {subscore.metrics.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-800"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {row.label}
              </div>
              <div className="mt-0.5 font-mono text-xs text-neutral-500">
                {row.rawValue}
              </div>
              {row.hint ? (
                <div className="mt-1 text-xs text-neutral-400">{row.hint}</div>
              ) : null}
            </div>
            <div
              className={`shrink-0 text-sm font-semibold tabular-nums ${scoreClass(row.score)}`}
            >
              {row.score}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
