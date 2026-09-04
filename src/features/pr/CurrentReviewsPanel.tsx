import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

import type { PrReviewItem, PrReviewsSnapshot } from "./types";

type Props = {
  snapshot: PrReviewsSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

function stateLabel(state: string): string {
  switch (state) {
    case "APPROVED":
      return "Approved";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "COMMENTED":
      return "Commented";
    case "DISMISSED":
      return "Dismissed";
    default:
      return state;
  }
}

function stateClass(state: string): string {
  switch (state) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "CHANGES_REQUESTED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "COMMENTED":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
    case "DISMISSED":
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
    default:
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
  }
}

function ReviewCard({ review }: { review: PrReviewItem }) {
  return (
    <article className="space-y-3 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {review.avatarUrl ? (
            <img
              src={review.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full border border-neutral-200 dark:border-neutral-800"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{review.user}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase",
                  stateClass(review.state),
                )}
              >
                {stateLabel(review.state)}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {review.submittedAt
                ? relativeTime(review.submittedAt)
                : "Unknown time"}
              {review.comments.length > 0
                ? ` · ${review.comments.length} inline`
                : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void openUrl(review.htmlUrl)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </Button>
      </header>

      {review.body ? (
        <pre className="rounded-md bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {review.body}
        </pre>
      ) : (
        <p className="text-xs text-neutral-400 italic">
          No review summary body.
        </p>
      )}

      {review.comments.length > 0 ? (
        <ul className="space-y-2">
          {review.comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-neutral-500">
                <span className="truncate">{c.path}</span>
                {c.line != null ? <span>:{c.line}</span> : null}
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {c.body || "(empty comment)"}
              </pre>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function CurrentReviewsPanel({
  snapshot,
  loading,
  error,
  onRefresh,
}: Props) {
  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4 text-neutral-600" />
            Current reviews
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Who already reviewed this PR on GitHub, including their summary and
            inline comments.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={onRefresh}
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
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reviews from GitHub…
        </div>
      ) : null}

      {snapshot ? (
        <>
          {snapshot.latestByUser.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.latestByUser.map((u) => (
                <div
                  key={u.user}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pr-2.5 pl-1 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="text-xs font-medium">{u.user}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase",
                      stateClass(u.state),
                    )}
                  >
                    {stateLabel(u.state)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">
            {snapshot.reviews.length} review submission
            {snapshot.reviews.length === 1 ? "" : "s"} · {snapshot.inlineCount}{" "}
            inline comment{snapshot.inlineCount === 1 ? "" : "s"}
          </p>

          {snapshot.reviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No reviews yet on this PR.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
              {snapshot.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
