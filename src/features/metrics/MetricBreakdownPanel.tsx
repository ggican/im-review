import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

import type { MetricsSubscore } from "./types";

function scoreClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-error";
}

export function MetricBreakdownPanel({
  subscore,
}: {
  subscore: MetricsSubscore | null;
}) {
  if (!subscore) {
    return (
      <Card padding="default">
        <CardContent>
          <p className="text-body-md text-on-surface-variant">
            Select a category to see metric breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card padding="default">
      <CardHeader className="mb-3">
        <CardTitle className="text-title-md">{subscore.label} breakdown</CardTitle>
        <CardDescription>
          Raw values shown next to each normalized score (0–100).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="overflow-hidden rounded-lg border border-border">
          {subscore.metrics.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-body-md font-medium text-on-surface">
                  {row.label}
                </div>
                <div className="mt-0.5 font-mono text-xs text-on-surface-variant">
                  {row.rawValue}
                </div>
                {row.hint ? (
                  <div className="mt-1 text-body-sm text-on-surface-variant">
                    {row.hint}
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "shrink-0 text-body-md font-semibold tabular-nums",
                  scoreClass(row.score),
                )}
              >
                {row.score}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
