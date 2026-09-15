import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

import { DeltaBadge, scoreBand } from "./DeltaBadge";
import type { ScoreTrend } from "./types";

function scoreTone(score: number): string {
  if (score >= 80) {
    return "border-success/30 bg-success-container/60 text-on-success-container";
  }
  if (score >= 60) {
    return "border-warning/30 bg-warning-container/60 text-on-warning-container";
  }
  return "border-error/30 bg-error-container/60 text-on-error-container";
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
    <Card padding="default" className={cn(scoreTone(overall))}>
      <CardHeader className="mb-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardDescription className="mb-1 opacity-90">
              Overall score
            </CardDescription>
            <CardTitle className="flex flex-wrap items-baseline gap-2 font-headline text-headline-xl">
              <span className="tabular-nums">{overall}</span>
              <span className="text-body-md font-normal opacity-80">/ 100</span>
              <DeltaBadge trend={trend} />
              <Badge variant="outline" className="border-current/30 uppercase">
                {scoreBand(overall)}
              </Badge>
            </CardTitle>
            <p className="mt-2 text-body-sm opacity-90">
              {login ? `@${login}` : "…"} · {aggregationLabel} · {windowLabel}
              {previousLabel ? ` vs ${previousLabel}` : ""}
              {generatedAt
                ? ` · updated ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </p>
          </div>
          <div className="space-y-0.5 font-keycap text-body-sm opacity-90">
            <div>25% Speed</div>
            <div>40% Throughput</div>
            <div>15% Quality</div>
            <div>20% Collaboration</div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
