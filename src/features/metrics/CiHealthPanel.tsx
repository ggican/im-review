import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/cn";

import type { CiHealthSummary } from "./types";

async function openPrUrl(url: string) {
  try {
    await openUrl(url);
  } catch (err) {
    toast.error(String(err));
  }
}

export function CiHealthPanel({
  summary,
  loading,
  windowLabel,
}: {
  summary: CiHealthSummary | null;
  loading: boolean;
  windowLabel: string;
}) {
  return (
    <Card padding="default">
      <CardHeader className="mb-3">
        <CardTitle className="text-title-md">CI Health</CardTitle>
        <CardDescription>
          Jenkins / GitHub checks across your authored PRs ({windowLabel}).
          Informational only — not included in Overall score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !summary ? (
          <p className="text-body-md text-on-surface-variant py-8 text-center">
            Loading CI health…
          </p>
        ) : null}

        {summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Passing" value={summary.passing} tone="success" />
              <Stat label="Pending" value={summary.pending} tone="pending" />
              <Stat label="Failing" value={summary.failing} tone="failure" />
              <Stat
                label="Pass rate"
                value={
                  summary.totalChecks === 0
                    ? "Unavailable"
                    : `${Math.round(summary.passRate * 100)}%`
                }
              />
            </div>

            {summary.totalChecks === 0 ? (
              <p className="border-border text-body-md text-on-surface-variant rounded-lg border border-dashed px-3 py-8 text-center">
                No CI checks found on authored PRs in this window.
              </p>
            ) : (
              <>
                {summary.topFailingContexts.length > 0 ? (
                  <div>
                    <h3 className="text-label-sm text-on-surface-variant mb-2 tracking-wide uppercase">
                      Top failing contexts
                    </h3>
                    <ul className="border-border overflow-hidden rounded-lg border">
                      {summary.topFailingContexts.map((item) => (
                        <li
                          key={item.name}
                          className="border-border flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                        >
                          <span className="text-body-md truncate">
                            {item.name}
                          </span>
                          <span className="font-keycap text-body-sm text-on-surface-variant shrink-0">
                            {item.count} fail{item.count === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summary.latestFailingPrs.length > 0 ? (
                  <div>
                    <h3 className="text-label-sm text-on-surface-variant mb-2 tracking-wide uppercase">
                      Latest failing PRs
                    </h3>
                    <ul className="border-border overflow-hidden rounded-lg border">
                      {summary.latestFailingPrs.map((pr) => (
                        <li
                          key={`${pr.repo}#${pr.number}`}
                          className="border-border bg-error-container/30 flex items-start gap-3 border-b px-3 py-3 last:border-b-0"
                        >
                          <XCircle
                            className="text-error mt-0.5 h-4 w-4 shrink-0"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-body-md truncate font-medium">
                              {pr.repo} #{pr.number}
                            </div>
                            <div className="text-body-sm text-on-surface-variant truncate">
                              {pr.title}
                            </div>
                            <div className="text-body-sm text-on-surface-variant mt-1">
                              {pr.failedChecks.slice(0, 3).join(", ")}
                              {pr.failedChecks.length > 3
                                ? ` +${pr.failedChecks.length - 3}`
                                : ""}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => void openPrUrl(pr.url)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

            <p className="text-body-sm text-on-surface-variant">
              {summary.prsWithChecks} PR
              {summary.prsWithChecks === 1 ? "" : "s"} with CI data ·{" "}
              {summary.totalChecks} total checks
            </p>
          </>
        ) : !loading ? (
          <p className="border-border text-body-md text-on-surface-variant rounded-lg border border-dashed px-3 py-8 text-center">
            No CI data available for this window.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "pending" | "failure";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "success" &&
          "border-success/30 bg-success-container/50 text-on-success-container",
        tone === "pending" &&
          "border-warning/30 bg-warning-container/50 text-on-warning-container",
        tone === "failure" &&
          "border-error/30 bg-error-container/50 text-on-error-container",
        !tone && "border-border bg-surface-container-low/50",
      )}
    >
      <div className="text-body-sm text-on-surface-variant">{label}</div>
      <div className="font-headline text-headline-sm mt-0.5 tabular-nums">
        {value}
      </div>
    </div>
  );
}
