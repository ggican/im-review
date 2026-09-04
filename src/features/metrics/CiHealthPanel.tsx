import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="text-sm font-semibold">CI Health</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Jenkins / GitHub checks across your authored PRs ({windowLabel}).
          Informational only — not included in Overall score.
        </p>
      </div>

      {loading && !summary ? (
        <p className="py-8 text-center text-sm text-neutral-500">
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
                  ? "—"
                  : `${Math.round(summary.passRate * 100)}%`
              }
            />
          </div>

          {summary.totalChecks === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No CI checks found on authored PRs in this window.
            </p>
          ) : (
            <>
              {summary.topFailingContexts.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                    Top failing contexts
                  </h3>
                  <ul className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {summary.topFailingContexts.map((item) => (
                      <li
                        key={item.name}
                        className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-2 last:border-b-0 dark:border-neutral-800"
                      >
                        <span className="truncate text-sm">{item.name}</span>
                        <span className="shrink-0 text-xs text-neutral-500">
                          {item.count} fail{item.count === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {summary.latestFailingPrs.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                    Latest failing PRs
                  </h3>
                  <ul className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {summary.latestFailingPrs.map((pr) => (
                      <li
                        key={`${pr.repo}#${pr.number}`}
                        className="flex items-start gap-3 border-b border-neutral-200 bg-red-50/30 px-3 py-3 last:border-b-0 dark:border-neutral-800 dark:bg-red-950/20"
                      >
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {pr.repo} #{pr.number}
                          </div>
                          <div className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                            {pr.title}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
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

          <p className="text-xs text-neutral-400">
            {summary.prsWithChecks} PR
            {summary.prsWithChecks === 1 ? "" : "s"} with CI data ·{" "}
            {summary.totalChecks} total checks
          </p>
        </>
      ) : null}
    </section>
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
          "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30",
        tone === "pending" &&
          "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30",
        tone === "failure" &&
          "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30",
        !tone &&
          "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
      )}
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
