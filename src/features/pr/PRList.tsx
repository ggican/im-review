import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  countNewPrs,
  getLastSeenSnapshot,
  isPrNew,
  markAllSeen,
  subscribeLastSeen,
} from "@/lib/seen";

import { PRRow } from "./PRRow";
import type { PrLists, PrTab, PullRequest } from "./types";

const TABS: { id: PrTab; label: string }[] = [
  { id: "all", label: "All open" },
  { id: "favorites", label: "Favorites" },
  { id: "assigned", label: "Assigned" },
  { id: "review", label: "Review requested" },
  { id: "mine", label: "My open" },
];

/** Client-side page size for the visible list (API already loads all pages). */
export const PR_LIST_PAGE_SIZE = 25;

type Props = {
  lists: PrLists;
  active: PrTab;
  onTabChange: (tab: PrTab) => void;
  loading: boolean;
  error: string | null;
  stale?: boolean;
  onRefresh: () => void;
  updatedAt: Date | null;
  onSelect: (pr: PullRequest) => void;
};

export function PRList({
  lists,
  active,
  onTabChange,
  loading,
  error,
  stale = false,
  onRefresh,
  updatedAt,
  onSelect,
}: Props) {
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );
  const [page, setPage] = useState(1);
  const items = useMemo(() => lists[active] ?? [], [lists, active]);
  const pending = useMemo(
    () => items.filter((pr) => !pr.localReviewEvent),
    [items],
  );
  const reviewed = useMemo(
    () => items.filter((pr) => pr.localReviewEvent),
    [items],
  );
  const newInActive = countNewPrs(items, lastSeen);
  const newTotal =
    countNewPrs(lists.all ?? [], lastSeen) +
    countNewPrs(lists.favorites ?? [], lastSeen) +
    countNewPrs(lists.assigned ?? [], lastSeen) +
    countNewPrs(lists.review ?? [], lastSeen) +
    countNewPrs(lists.mine ?? [], lastSeen);

  const ordered = useMemo(() => [...pending, ...reviewed], [pending, reviewed]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / PR_LIST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PR_LIST_PAGE_SIZE;
    return ordered.slice(start, start + PR_LIST_PAGE_SIZE);
  }, [ordered, safePage]);
  const pagePending = pageItems.filter((pr) => !pr.localReviewEvent);
  const pageReviewed = pageItems.filter((pr) => pr.localReviewEvent);

  useEffect(() => {
    setPage(1);
  }, [active, items.length]);

  const emptyMessage =
    active === "favorites" ? (
      <>
        No open PRs in favorite repos.{" "}
        <Link
          to="/repos"
          className="underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Manage favorites
        </Link>
      </>
    ) : active === "all" ? (
      "No open pull requests found."
    ) : (
      "No pull requests in this list."
    );

  return (
    <section className="flex flex-col gap-3">
      <div
        data-testid="pr-list-toolbar"
        className="flex flex-nowrap items-center gap-2"
      >
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div
            role="tablist"
            aria-label="Pull request lists"
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 whitespace-nowrap dark:border-neutral-800 dark:bg-neutral-900"
          >
            {TABS.map((tab) => {
              const selected = tab.id === active;
              const newCount = countNewPrs(lists[tab.id] ?? [], lastSeen);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 text-neutral-400 tabular-nums">
                    {(lists[tab.id] ?? []).length}
                  </span>
                  {newCount > 0 ? (
                    <span
                      className={cn(
                        "ml-1.5 rounded-sm px-1 py-0.5 text-xs font-semibold tabular-nums",
                        selected
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                          : "bg-sky-100/80 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400",
                      )}
                    >
                      {newCount} new
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div
          data-testid="pr-list-actions"
          className="flex shrink-0 flex-nowrap items-center gap-2"
        >
          {newTotal > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => markAllSeen()}
              title="Clear New badges until the next update"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark seen
              <span className="tabular-nums opacity-70">{newTotal}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          className={
            stale
              ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }
        >
          {error}
        </div>
      ) : null}

      {stale && !error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Menampilkan list tersimpan (cache). Data mungkin tidak terbaru.
        </div>
      ) : null}

      {newInActive > 0 ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          {newInActive} PR{newInActive === 1 ? "" : "s"} updated since you last
          marked seen.
        </div>
      ) : null}

      <div
        data-testid="pr-list-refresh-row"
        className="flex flex-wrap items-center justify-end gap-2"
      >
        {updatedAt ? (
          <span className="text-xs whitespace-nowrap text-neutral-400">
            Updated {updatedAt.toLocaleTimeString()}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
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

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pull requests…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-neutral-500">
            {emptyMessage}
          </div>
        ) : (
          <div>
            {pagePending.length > 0 ? (
              <div>
                {pending.length > 0 && reviewed.length > 0 && safePage === 1 ? (
                  <div className="bg-neutral-50 px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:bg-neutral-900/80">
                    Needs review ({pending.length})
                  </div>
                ) : null}
                <ul>
                  {pagePending.map((pr) => (
                    <PRRow
                      key={`${pr.repo}#${pr.number}`}
                      pr={pr}
                      isNew={isPrNew(pr, lastSeen)}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {pageReviewed.length > 0 ? (
              <div>
                <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:bg-neutral-900/80">
                  Already reviewed ({reviewed.length})
                </div>
                <ul>
                  {pageReviewed.map((pr) => (
                    <PRRow
                      key={`${pr.repo}#${pr.number}-reviewed`}
                      pr={pr}
                      isNew={isPrNew(pr, lastSeen)}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {ordered.length > PR_LIST_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
          <span>
            {(safePage - 1) * PR_LIST_PAGE_SIZE + 1}–
            {Math.min(safePage * PR_LIST_PAGE_SIZE, ordered.length)} of{" "}
            {ordered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="px-2 tabular-nums">
              {safePage}/{pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
