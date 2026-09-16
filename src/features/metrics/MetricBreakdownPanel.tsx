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
        <CardTitle className="text-title-md">
          {subscore.label} breakdown
        </CardTitle>
        <CardDescription>
          Raw values shown next to each normalized score (0–100).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="border-border overflow-hidden rounded-lg border">
          {subscore.metrics.map((row) => (
            <li
              key={row.key}
              className="border-border flex items-start justify-between gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-body-md text-on-surface font-medium">
                  {row.label}
                </div>
                <div className="text-on-surface-variant mt-0.5 font-mono text-xs">
                  {row.rawValue}
                </div>
                {row.hint ? (
                  <div className="text-body-sm text-on-surface-variant mt-1">
                    {row.hint}
                  </div>
                ) : null}
              </div>
              <div
                className={cn(
                  "text-body-md shrink-0 font-semibold tabular-nums",
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
