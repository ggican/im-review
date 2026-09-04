import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  CiCheckItem,
  CiChecksSnapshot,
  CiStatus,
} from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

function stateIcon(state: CiStatus) {
  switch (state) {
    case "success":
      return (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      );
    case "failure":
      return (
        <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      );
    case "pending":
      return (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
      );
    default:
      return <Circle className="h-4 w-4 shrink-0 text-neutral-400" />;
  }
}

function overallLabel(overall: CiStatus): string {
  switch (overall) {
    case "success":
      return "All checks passed";
    case "failure":
      return "Some checks failed";
    case "pending":
      return "Checks in progress";
    default:
      return "No CI checks reported";
  }
}

function overallClass(overall: CiStatus): string {
  switch (overall) {
    case "success":
      return "border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "failure":
      return "border-red-200 bg-red-50/50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200";
    case "pending":
      return "border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300";
  }
}

function sourceLabel(source: CiCheckItem["source"]): string {
  return source === "status" ? "Status" : "Check";
}

async function openCheckUrl(url: string | null) {
  if (!url) {
    toast.error("No build URL for this check");
    return;
  }
  try {
    await openUrl(url);
  } catch (err) {
    toast.error(String(err));
  }
}

export function CiChecksPanel({
  snapshot,
  loading,
  error,
  onRefresh,
}: {
  snapshot: CiChecksSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">CI / Jenkins</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Commit statuses and check runs on the PR head (Jenkins builds
            usually appear as statuses with a build link).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading CI checks…
        </div>
      ) : null}

      {snapshot ? (
        <>
          <div
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
              overallClass(snapshot.overall),
            )}
          >
            {stateIcon(snapshot.overall)}
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {overallLabel(snapshot.overall)}
              </div>
              <div className="mt-0.5 font-mono text-xs opacity-80">
                {snapshot.sha.slice(0, 7)} · {snapshot.failedCount} failed ·{" "}
                {snapshot.pendingCount} pending · {snapshot.successCount} passed
              </div>
            </div>
          </div>

          {snapshot.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              No CI statuses or check runs on this commit yet.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
              {snapshot.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 border-b border-neutral-200 px-3 py-3 last:border-b-0 dark:border-neutral-800",
                    item.state === "failure" &&
                      "bg-red-50/40 dark:bg-red-950/20",
                  )}
                >
                  <div className="mt-0.5">{stateIcon(item.state)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-xs tracking-wide text-neutral-400 uppercase">
                        {sourceLabel(item.source)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {item.description}
                    </p>
                    {item.updatedAt ? (
                      <p className="mt-1 text-xs text-neutral-400">
                        {relativeTime(item.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                  {item.targetUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => void openCheckUrl(item.targetUrl)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
