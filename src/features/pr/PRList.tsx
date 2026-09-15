import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { AuthorFilterBar } from "@/features/people/AuthorFilterBar";
import type { AuthorFilterMode } from "@/features/people/types";
import { cn } from "@/lib/cn";
import {
  countNewPrs,
  getLastSeenSnapshot,
  isPrNew,
  markAllSeen,
  subscribeLastSeen,
} from "@/lib/seen";
import { useFavoriteUsers, useSettings } from "@/lib/use-settings";

import { PRRow } from "./PRRow";
import { prKey, type PrLists, type PrTab, type PullRequest } from "./types";

const BASE_TABS: { id: PrTab; label: string }[] = [
  { id: "all", label: "All open" },
  { id: "favorites", label: "Favorites" },
  { id: "assigned", label: "Assigned" },
  { id: "review", label: "Review requested" },
  { id: "reviewed", label: "Already reviewed" },
  { id: "mine", label: "My open" },
];

const PEOPLE_TAB: { id: PrTab; label: string } = {
  id: "people",
  label: "People",
};

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
  authorLogin?: string | null;
  authorMode?: AuthorFilterMode;
  onAuthorChange?: (login: string | null, mode: AuthorFilterMode) => void;
  searchItems?: PullRequest[];
  searchLoading?: boolean;
  searchError?: string | null;
  /** Optional CI failure descriptions keyed by `repo#number`. */
  ciFailures?: Record<string, string>;
};

function matchesQuery(pr: PullRequest, q: string): boolean {
  if (!q) return true;
  const hay = [
    pr.title,
    pr.repo,
    `#${pr.number}`,
    pr.author.login,
    pr.headBranch ?? "",
    pr.baseBranch ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

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
  authorLogin = null,
  authorMode = "filter",
  onAuthorChange,
  searchItems = [],
  searchLoading = false,
  searchError = null,
  ciFailures = {},
}: Props) {
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );
  const favoriteUsers = useFavoriteUsers();
  const { showFavoritePeople } = useSettings();
  const tabs = showFavoritePeople ? [...BASE_TABS, PEOPLE_TAB] : BASE_TABS;
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const tabItems = useMemo(() => lists[active] ?? [], [lists, active]);
  const searching = authorMode === "search" && Boolean(authorLogin);
  const authorFiltered = useMemo(() => {
    if (searching) return searchItems;
    if (!authorLogin) return tabItems;
    const needle = authorLogin.toLowerCase();
    return tabItems.filter((pr) => pr.author.login.toLowerCase() === needle);
  }, [searching, searchItems, authorLogin, tabItems]);
  const q = query.trim().toLowerCase();
  const items = useMemo(
    () => authorFiltered.filter((pr) => matchesQuery(pr, q)),
    [authorFiltered, q],
  );
  const listLoading = loading || (searching && searchLoading);
  const listError = searching ? searchError || error : error;
  const isReviewedTab = active === "reviewed" && !searching;
  const pending = useMemo(
    () => (isReviewedTab ? [] : items.filter((pr) => !pr.localReviewEvent)),
    [items, isReviewedTab],
  );
  const reviewed = useMemo(
    () => (isReviewedTab ? items : items.filter((pr) => pr.localReviewEvent)),
    [items, isReviewedTab],
  );
  const newInActive = countNewPrs(items, lastSeen);
  const newTotal =
    countNewPrs(lists.all ?? [], lastSeen) +
    countNewPrs(lists.favorites ?? [], lastSeen) +
    countNewPrs(lists.assigned ?? [], lastSeen) +
    countNewPrs(lists.review ?? [], lastSeen) +
    countNewPrs(lists.reviewed ?? [], lastSeen) +
    countNewPrs(lists.mine ?? [], lastSeen) +
    (showFavoritePeople ? countNewPrs(lists.people ?? [], lastSeen) : 0);

  const ordered = useMemo(
    () => (isReviewedTab ? items : [...pending, ...reviewed]),
    [isReviewedTab, items, pending, reviewed],
  );
  const pageCount = Math.max(1, Math.ceil(ordered.length / PR_LIST_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PR_LIST_PAGE_SIZE;
    return ordered.slice(start, start + PR_LIST_PAGE_SIZE);
  }, [ordered, safePage]);
  const pagePending = isReviewedTab
    ? []
    : pageItems.filter((pr) => !pr.localReviewEvent);
  const pageReviewed = isReviewedTab
    ? pageItems
    : pageItems.filter((pr) => pr.localReviewEvent);

  useEffect(() => {
    setPage(1);
  }, [active, items.length, authorLogin, authorMode, q]);

  const emptyMessage =
    q && authorFiltered.length > 0 && items.length === 0 ? (
      `No pull requests match “${query.trim()}”.`
    ) : authorLogin && items.length === 0 && !listLoading ? (
      searching ? (
        `No open PRs by @${authorLogin}.`
      ) : (
        <>
          No open PRs by @{authorLogin} in this list.{" "}
          {onAuthorChange ? (
            <button
              type="button"
              className="underline underline-offset-2 hover:text-on-surface"
              onClick={() => onAuthorChange(authorLogin, "search")}
            >
              Show all PRs by @{authorLogin}
            </button>
          ) : null}
        </>
      )
    ) : active === "favorites" ? (
      <>
        No open PRs in favorite repos.{" "}
        <Link
          to="/repos"
          className="underline underline-offset-2 hover:text-on-surface"
        >
          Manage favorites
        </Link>
      </>
    ) : active === "all" ? (
      "No open pull requests found."
    ) : active === "assigned" ? (
      "No pull requests assigned to you."
    ) : active === "people" ? (
      favoriteUsers.length === 0 ? (
        <>
          No favorite people yet.{" "}
          <Link
            to="/settings"
            className="underline underline-offset-2 hover:text-on-surface"
          >
            Add favorite people
          </Link>
        </>
      ) : (
        "No open PRs from favorite people."
      )
    ) : active === "reviewed" ? (
      <>
        No reviews submitted from IM Review yet. Approve or comment on a PR and
        it will show up here.{" "}
        <Link
          to="/settings"
          className="underline underline-offset-2 hover:text-on-surface"
        >
          Open History
        </Link>
      </>
    ) : (
      "No pull requests in this list."
    );

  return (
    <section className="flex flex-col gap-3">
      <div
        data-testid="pr-list-toolbar"
        className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, author, repo, branch…"
            aria-label="Search pull requests"
            className="h-8 pl-8 text-xs"
          />
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

      <div
        data-testid="pr-list-refresh-row"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <div className="min-w-0 flex-1 overflow-x-auto">
          <TabsList
            aria-label="Pull request lists"
            className="h-auto whitespace-nowrap"
          >
            {tabs.map((tab) => {
              const selected = tab.id === active;
              const newCount = countNewPrs(lists[tab.id] ?? [], lastSeen);
              return (
                <TabsTrigger
                  key={tab.id}
                  id={`pr-list-tab-${tab.id}`}
                  aria-controls="pr-list-tab-panel"
                  active={selected}
                  onClick={() => onTabChange(tab.id)}
                >
                  {tab.label}
                  <span className="font-keycap text-on-surface-variant tabular-nums">
                    {(lists[tab.id] ?? []).length}
                  </span>
                  {newCount > 0 ? (
                    <Badge
                      variant="accent"
                      className="px-1 py-0 text-[10px] tabular-nums"
                    >
                      {newCount} new
                    </Badge>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
          <div className="flex shrink-0 items-center gap-2">
          {updatedAt ? (
            <span className="text-body-sm whitespace-nowrap text-on-surface-variant">
              Updated {updatedAt.toLocaleTimeString()}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={listLoading}
          >
            {listLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {onAuthorChange ? (
        <AuthorFilterBar
          authorLogin={authorLogin}
          authorMode={authorMode}
          tabItems={tabItems}
          favoriteUsers={favoriteUsers}
          onChange={onAuthorChange}
        />
      ) : null}

      {searching && authorLogin ? (
        <p className="text-body-sm text-on-surface-variant">
          Open PRs by @{authorLogin} ({items.length})
        </p>
      ) : null}

      {listError ? (
        <ErrorBlock tone={stale ? "warning" : "error"}>{listError}</ErrorBlock>
      ) : null}

      {stale && !listError ? (
        <ErrorBlock tone="warning">
          Showing a cached list. Data may be out of date — Refresh when ready.
        </ErrorBlock>
      ) : null}

      {newInActive > 0 ? (
        <div className="rounded-lg border border-stream-github-border bg-stream-github px-3 py-2 text-body-sm text-stream-github-fg">
          {newInActive} PR{newInActive === 1 ? "" : "s"} updated since you last
          marked seen.
        </div>
      ) : null}

      <TabsPanel
        id="pr-list-tab-panel"
        aria-labelledby={`pr-list-tab-${active}`}
      >
      <Card padding="none" className="overflow-hidden">
        {listLoading && items.length === 0 ? (
          <LoadingBlock embedded>Loading pull requests…</LoadingBlock>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center text-body-md text-on-surface-variant">
            {emptyMessage}
          </div>
        ) : (
          <div>
            {pagePending.length > 0 ? (
              <div>
                {pending.length > 0 && reviewed.length > 0 && safePage === 1 ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-border bg-stream-github/50 px-3 py-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary-container"
                      aria-hidden
                    />
                    <h2 className="text-label-sm font-semibold tracking-wide text-on-surface uppercase">
                      Needs review ({pending.length})
                    </h2>
                    <Badge variant="accent">{pending.length} pending</Badge>
                    <span className="ml-auto text-body-sm text-on-surface-variant">
                      Awaiting your approval or input
                    </span>
                  </div>
                ) : null}
                <ul>
                  {pagePending.map((pr) => (
                    <PRRow
                      key={`${pr.repo}#${pr.number}`}
                      pr={pr}
                      isNew={isPrNew(pr, lastSeen)}
                      ciFailure={ciFailures[prKey(pr.repo, pr.number)] ?? null}
                      onSelect={onSelect}
                      onFilterAuthor={
                        onAuthorChange
                          ? (login) => onAuthorChange(login, "filter")
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            ) : null}
            {pageReviewed.length > 0 ? (
              <div>
                {!isReviewedTab ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 bg-stream-ai/50 px-3 py-2",
                      pagePending.length > 0 && "border-t border-border",
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-success"
                      aria-hidden
                    />
                    <h2 className="text-label-sm font-semibold tracking-wide text-on-surface-variant uppercase">
                      Already reviewed ({reviewed.length})
                    </h2>
                    <Badge variant="success">{reviewed.length} tracked</Badge>
                    <span className="ml-auto text-body-sm text-on-surface-variant">
                      You submitted feedback or approved
                    </span>
                  </div>
                ) : null}
                <ul>
                  {pageReviewed.map((pr) => (
                    <PRRow
                      key={`${pr.repo}#${pr.number}-reviewed`}
                      pr={pr}
                      isNew={isPrNew(pr, lastSeen)}
                      ciFailure={ciFailures[prKey(pr.repo, pr.number)] ?? null}
                      onSelect={onSelect}
                      onFilterAuthor={
                        onAuthorChange
                          ? (login) => onAuthorChange(login, "filter")
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {ordered.length > PR_LIST_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 text-body-sm text-on-surface-variant">
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
      </TabsPanel>
    </section>
  );
}
