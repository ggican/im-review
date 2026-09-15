import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  MinusCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  CiCheckItem,
  CiChecksSnapshot,
  CiStatus,
} from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

type VisualState = CiStatus | "cancelled";

function isCancelled(item: CiCheckItem): boolean {
  return item.conclusion?.toLowerCase() === "cancelled";
}

function visualState(item: CiCheckItem): VisualState {
  if (isCancelled(item)) return "cancelled";
  return item.state;
}

function overallIsCancelledOnly(snapshot: CiChecksSnapshot): boolean {
  if (snapshot.overall !== "failure") return false;
  const failed = snapshot.items.filter((i) => i.state === "failure");
  return failed.length > 0 && failed.every(isCancelled);
}

function stateIcon(state: VisualState) {
  switch (state) {
    case "success":
      return (
        <CheckCircle2
          className="h-4 w-4 shrink-0 text-success"
          aria-hidden
        />
      );
    case "failure":
      return <XCircle className="h-4 w-4 shrink-0 text-error" aria-hidden />;
    case "pending":
      return (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-warning dark:text-primary-container"
          aria-hidden
        />
      );
    case "cancelled":
      return (
        <MinusCircle
          className="h-4 w-4 shrink-0 text-on-surface-variant"
          aria-hidden
        />
      );
    default:
      return (
        <Circle
          className="h-4 w-4 shrink-0 text-on-surface-variant"
          aria-hidden
        />
      );
  }
}

function overallLabel(snapshot: CiChecksSnapshot): string {
  if (overallIsCancelledOnly(snapshot)) return "Cancelled";
  switch (snapshot.overall) {
    case "success":
      return "Passing";
    case "failure":
      return "Failing";
    case "pending":
      return "Running";
    default:
      return "No checks";
  }
}

function overallDetail(snapshot: CiChecksSnapshot): string {
  if (overallIsCancelledOnly(snapshot)) {
    return "All failing checks were cancelled";
  }
  switch (snapshot.overall) {
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

function overallBadgeVariant(
  snapshot: CiChecksSnapshot,
): "success" | "error" | "warning" | "outline" | "accent" {
  if (overallIsCancelledOnly(snapshot)) return "outline";
  switch (snapshot.overall) {
    case "success":
      return "success";
    case "failure":
      return "error";
    case "pending":
      return "warning";
    default:
      return "outline";
  }
}

function overallBannerClass(snapshot: CiChecksSnapshot): string {
  if (overallIsCancelledOnly(snapshot)) {
    return "border-border bg-surface-container-low/60 text-on-surface";
  }
  switch (snapshot.overall) {
    case "success":
      return "border-success/30 bg-success-container/50 text-on-success-container";
    case "failure":
      return "border-error/30 bg-error-container/50 text-on-error-container";
    case "pending":
      return "border-warning/40 bg-warning-container/60 text-on-warning-container dark:border-primary-container/40 dark:bg-stream-github/50 dark:text-stream-github-fg";
    default:
      return "border-border bg-surface-container-low/50 text-on-surface-variant";
  }
}

function itemBadgeVariant(
  state: VisualState,
): "success" | "error" | "warning" | "outline" | "secondary" {
  switch (state) {
    case "success":
      return "success";
    case "failure":
      return "error";
    case "pending":
      return "warning";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

function visualLabel(state: VisualState): string {
  switch (state) {
    case "success":
      return "Passing";
    case "failure":
      return "Failing";
    case "pending":
      return "Running";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unavailable";
  }
}

function sourceLabel(source: CiCheckItem["source"]): string {
  return source === "status" ? "Status" : "Check run";
}

function formatDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): string | null {
  if (!startedAt || !completedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `${min}m ${rem}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
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
  headBranch,
}: {
  snapshot: CiChecksSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  headBranch?: string | null;
}) {
  return (
    <section className="space-y-4">
      <Card padding="default">
        <CardHeader className="mb-3 flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-title-md font-semibold">
              CI status
            </CardTitle>
            <CardDescription>
              Commit statuses and check runs on the PR head (Jenkins builds
              usually appear as statuses with a build link).
            </CardDescription>
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
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning-container px-3 py-2 text-body-sm text-on-warning-container"
            >
              {error}
            </div>
          ) : null}

          {loading && !snapshot ? (
            <div className="flex items-center gap-2 py-8 text-body-md text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading CI checks…
            </div>
          ) : null}

          {snapshot ? (
            <>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5",
                  overallBannerClass(snapshot),
                )}
              >
                {stateIcon(
                  overallIsCancelledOnly(snapshot)
                    ? "cancelled"
                    : snapshot.overall,
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-md font-semibold">
                      {overallLabel(snapshot)}
                    </span>
                    <Badge variant={overallBadgeVariant(snapshot)}>
                      {overallDetail(snapshot)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-keycap text-body-sm opacity-90">
                    {headBranch ? (
                      <span className="font-mono text-xs">{headBranch}</span>
                    ) : null}
                    {headBranch ? <span aria-hidden>·</span> : null}
                    <span className="font-mono text-xs">
                      {snapshot.sha.slice(0, 7)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{snapshot.failedCount} failed</span>
                    <span aria-hidden>·</span>
                    <span>{snapshot.pendingCount} running</span>
                    <span aria-hidden>·</span>
                    <span>{snapshot.successCount} passed</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Passed
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-success tabular-nums">
                    {snapshot.successCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Failed
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-error tabular-nums">
                    {snapshot.failedCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Running
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-warning tabular-nums dark:text-primary-container">
                    {snapshot.pendingCount}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {snapshot ? (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-headline text-title-md font-semibold text-on-surface">
              Check runs
            </h3>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">
              Failures and running checks surface first.
            </p>
          </div>

          {snapshot.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
              No CI statuses or check runs on this commit yet.
            </p>
          ) : (
            <ul>
              {snapshot.items.map((item) => {
                const visual = visualState(item);
                const duration = formatDuration(
                  item.startedAt,
                  item.completedAt,
                );
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0",
                      visual === "failure" &&
                        "bg-error-container/30 dark:bg-red-950/25",
                      visual === "cancelled" &&
                        "bg-surface-container-low/40",
                    )}
                  >
                    <div className="mt-0.5">{stateIcon(visual)}</div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-body-md font-medium text-on-surface">
                          {item.name}
                        </span>
                        <Badge
                          variant={itemBadgeVariant(visual)}
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {visualLabel(visual)}
                        </Badge>
                        <span className="font-keycap text-on-surface-variant">
                          {sourceLabel(item.source)}
                        </span>
                      </div>
                      <p className="text-body-sm text-on-surface-variant">
                        {item.description}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-keycap text-on-surface-variant">
                        {item.startedAt ? (
                          <span>
                            Started {relativeTime(item.startedAt)}
                          </span>
                        ) : null}
                        {item.completedAt ? (
                          <span>
                            Completed {relativeTime(item.completedAt)}
                          </span>
                        ) : item.updatedAt && !item.startedAt ? (
                          <span>{relativeTime(item.updatedAt)}</span>
                        ) : null}
                        {duration ? (
                          <span className="font-mono text-xs">
                            Duration {duration}
                          </span>
                        ) : null}
                        {item.conclusion && !isCancelled(item) ? (
                          <span className="font-mono text-xs">
                            {item.conclusion}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {item.targetUrl ? (
                      <IconButton
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Open"
                        className="shrink-0"
                        onClick={() => void openCheckUrl(item.targetUrl)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </section>
  );
}
