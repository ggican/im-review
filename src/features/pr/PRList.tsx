import { CheckCheck, Loader2, RefreshCw, Star } from "lucide-react";
import { useSyncExternalStore } from "react";
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
  { id: "assigned", label: "Assigned" },
  { id: "review", label: "Review requested" },
  { id: "mine", label: "My open" },
];

type Props = {
  lists: PrLists;
  active: PrTab;
  onTabChange: (tab: PrTab) => void;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  updatedAt: Date | null;
  onSelect: (pr: PullRequest) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  favoriteCount: number;
};

export function PRList({
  lists,
  active,
  onTabChange,
  loading,
  error,
  onRefresh,
  updatedAt,
  onSelect,
  favoritesOnly,
  onFavoritesOnlyChange,
  favoriteCount,
}: Props) {
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );
  const items: PullRequest[] = lists[active];
  const pending = items.filter((pr) => !pr.localReviewEvent);
  const reviewed = items.filter((pr) => pr.localReviewEvent);
  const newInActive = countNewPrs(items, lastSeen);
  const newTotal =
    countNewPrs(lists.assigned, lastSeen) +
    countNewPrs(lists.review, lastSeen) +
    countNewPrs(lists.mine, lastSeen);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Pull request lists"
          className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          {TABS.map((tab) => {
            const selected = tab.id === active;
            const newCount = countNewPrs(lists[tab.id], lastSeen);
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
                  {lists[tab.id].length}
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
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            type="button"
            size="sm"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
            aria-pressed={favoritesOnly}
            title={
              favoriteCount === 0
                ? "Add favorites from Repos first"
                : "Show PRs from favorite repos only"
            }
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                favoritesOnly && "fill-amber-400 text-amber-400",
              )}
            />
            Favorites
            {favoriteCount > 0 ? (
              <span className="tabular-nums opacity-70">{favoriteCount}</span>
            ) : null}
          </Button>
          {updatedAt ? (
            <span className="text-xs text-neutral-400">
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
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {newInActive > 0 ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
          {newInActive} PR{newInActive === 1 ? "" : "s"} updated since you last
          marked seen.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pull requests…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-neutral-500">
            {favoritesOnly ? (
              <>
                No PRs in favorite repos.{" "}
                <Link
                  to="/repos"
                  className="underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Manage favorites
                </Link>
              </>
            ) : (
              "No pull requests in this list."
            )}
          </div>
        ) : (
          <div>
            {pending.length > 0 ? (
              <div>
                {reviewed.length > 0 ? (
                  <div className="bg-neutral-50 px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:bg-neutral-900/80">
                    Needs review ({pending.length})
                  </div>
                ) : null}
                <ul>
                  {pending.map((pr) => (
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
            {reviewed.length > 0 ? (
              <div>
                <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:bg-neutral-900/80">
                  Already reviewed ({reviewed.length})
                </div>
                <ul>
                  {reviewed.map((pr) => (
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
    </section>
  );
}
