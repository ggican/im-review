import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuthorFilterMode } from "@/features/people/types";
import { fetchOpenPrsByAuthor } from "@/features/pr/api";
import { type CiWatchHit, scanMineCiFailures } from "@/features/pr/ci-watch";
import { useMyPRs } from "@/features/pr/hooks";
import { PRList } from "@/features/pr/PRList";
import type { PrLists, PrTab, PullRequest } from "@/features/pr/types";
import {
  latestReviewsByPr,
  prKey,
  savedReviewToPullRequest,
} from "@/features/pr/types";
import {
  NeedsMeSection,
  type SourceFilter,
  TodayHeader,
  TodaySidePreviews,
  TodaySummaryCards,
  useSourceFilter,
} from "@/features/today/TodayView";
import { useTodaySideData } from "@/features/today/useTodaySideData";
import { api, type GithubUser } from "@/lib/api";
import { updateDesktopAlerts } from "@/lib/desktop-alerts";
import {
  countNewPrs,
  ensureLastSeenSeeded,
  getLastSeenSnapshot,
  subscribeLastSeen,
} from "@/lib/seen";
import { useFavorites, useSavedReviews, useSettings } from "@/lib/use-settings";

/** Annotate live PRs + fill Already reviewed tab from local submit history. */
function mergeLocalReviews(
  lists: PrLists,
  saved: ReturnType<typeof latestReviewsByPr>,
): PrLists {
  const annotate = (items: PullRequest[]) =>
    items.map((pr) => {
      const local = saved.get(prKey(pr.repo, pr.number));
      if (!local) return pr;
      return {
        ...pr,
        localReviewEvent: local.event,
        headBranch: pr.headBranch ?? local.branch,
      };
    });

  const all = annotate(lists.all);
  const favorites = annotate(lists.favorites);
  const assigned = annotate(lists.assigned);
  const mine = annotate(lists.mine);
  const people = annotate(lists.people);
  const reviewLive = annotate(lists.review);

  // Review requested = still waiting on you (not yet submitted from this app).
  const review = reviewLive.filter((pr) => !pr.localReviewEvent);

  const reviewed = [...saved.values()]
    .map(savedReviewToPullRequest)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return { all, favorites, assigned, review, reviewed, mine, people };
}

function reviewPath(pr: PullRequest): string {
  const [owner, name] = pr.repo.split("/");
  return `/review/${owner}/${name}/${pr.number}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const settings = useSettings();
  const favorites = useFavorites();
  const savedReviews = useSavedReviews();
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );
  const [user, setUser] = useState<GithubUser | null>(null);
  const [tab, setTab] = useState<PrTab>("favorites");
  const [ciFails, setCiFails] = useState<CiWatchHit[]>([]);
  const authorLogin = searchParams.get("author");
  const authorMode: AuthorFilterMode =
    searchParams.get("by") === "all" ? "search" : "filter";
  const [searchItems, setSearchItems] = useState<PullRequest[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const hub = searchParams.get("hub");
  const isPrHub = hub === "prs";
  const ready = Boolean(user);
  const { lists, loading, error, stale, updatedAt, refresh } = useMyPRs(
    ready,
    tab,
  );
  const side = useTodaySideData(ready && !isPrHub);
  const [sourceFilter, setSourceFilter] = useSourceFilter(
    isPrHub ? "prs" : "all",
  );

  const visibleLists = useMemo(
    () => mergeLocalReviews(lists, latestReviewsByPr(savedReviews)),
    [lists, savedReviews],
  );

  const newCount = useMemo(() => {
    return (
      countNewPrs(visibleLists.all, lastSeen) +
      countNewPrs(visibleLists.favorites, lastSeen) +
      countNewPrs(visibleLists.assigned, lastSeen) +
      countNewPrs(visibleLists.review, lastSeen) +
      countNewPrs(visibleLists.reviewed, lastSeen) +
      countNewPrs(visibleLists.mine, lastSeen) +
      (settings.showFavoritePeople
        ? countNewPrs(visibleLists.people, lastSeen)
        : 0)
    );
  }, [visibleLists, lastSeen, settings.showFavoritePeople]);

  const needsMeCount = useMemo(() => {
    const reviewKeys = new Set(
      visibleLists.review.map((p) => prKey(p.repo, p.number)),
    );
    const extraCi = ciFails.filter(
      (h) => !reviewKeys.has(prKey(h.pr.repo, h.pr.number)),
    ).length;
    return (
      visibleLists.review.length +
      extraCi +
      side.jira.length +
      side.gmail.length
    );
  }, [visibleLists.review, ciFails, side.jira.length, side.gmail.length]);

  const sourceCounts = useMemo(() => {
    const prs = visibleLists.review.length + ciFails.length;
    return {
      all: prs + side.jira.length + side.gmail.length,
      prs,
      jira: side.jira.length,
      mail: side.gmail.length,
    };
  }, [visibleLists.review, ciFails, side.jira, side.gmail]);

  const nextMeetingLabel = useMemo(() => {
    const first = side.calendar[0];
    if (!first) return null;
    return first.title ? `Next: ${first.title}` : "Later today";
  }, [side.calendar]);

  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) IM Review` : "IM Review";
  }, [newCount]);

  useEffect(() => {
    ensureLastSeenSeeded();
  }, []);

  useEffect(() => {
    if (!settings.showFavoritePeople && tab === "people") {
      setTab("favorites");
    }
  }, [settings.showFavoritePeople, tab]);

  useEffect(() => {
    setSourceFilter(isPrHub ? "prs" : "all");
  }, [isPrHub, setSourceFilter]);

  useEffect(() => {
    if (!authorLogin || authorMode !== "search") {
      setSearchItems([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    void fetchOpenPrsByAuthor(authorLogin)
      .then((items) => {
        if (cancelled) return;
        setSearchItems(items);
        setSearchError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSearchError(String(err));
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authorLogin, authorMode]);

  function onAuthorChange(login: string | null, mode: AuthorFilterMode) {
    const next = new URLSearchParams(searchParams);
    if (!login) {
      next.delete("author");
      next.delete("by");
    } else {
      next.set("author", login);
      if (mode === "search") next.set("by", "all");
      else next.delete("by");
    }
    setSearchParams(next, { replace: true });
  }

  useEffect(() => {
    api
      .validateToken()
      .then(setUser)
      .catch((err) => {
        toast.error(String(err));
        navigate("/onboarding", { replace: true });
      });
  }, [navigate]);

  useEffect(() => {
    if (!ready || lists.mine.length === 0) {
      setCiFails([]);
      return;
    }
    let cancelled = false;
    void scanMineCiFailures(lists.mine).then((hits) => {
      if (!cancelled) setCiFails(hits);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, lists.mine, updatedAt]);

  useEffect(() => {
    void updateDesktopAlerts({
      newCount,
      ciFailCount: ciFails.length,
    });
  }, [newCount, ciFails.length]);

  async function onRefreshAll() {
    await Promise.all([refresh(), side.refresh()]);
  }

  if (isPrHub) {
    const openKeys = new Set<string>();
    for (const list of [
      visibleLists.all,
      visibleLists.favorites,
      visibleLists.assigned,
      visibleLists.review,
      visibleLists.mine,
    ]) {
      for (const p of list) openKeys.add(prKey(p.repo, p.number));
    }
    const openCount = openKeys.size;
    const repoCount = new Set(
      [
        ...visibleLists.all,
        ...visibleLists.favorites,
        ...visibleLists.assigned,
        ...visibleLists.review,
        ...visibleLists.mine,
      ].map((p) => p.repo),
    ).size;
    const ciFailureMap = Object.fromEntries(
      ciFails.map((hit) => [
        prKey(hit.pr.repo, hit.pr.number),
        hit.description,
      ]),
    );

    return (
      <PageShell width="full" className="gap-4">
        <PageHeader
          title="Pull Requests"
          leading={
            openCount > 0 ? (
              <Badge variant="github" className="mt-1 normal-case">
                {openCount} open
                {repoCount > 0 ? ` · ${repoCount} repos` : ""}
              </Badge>
            ) : (
              <Badge variant="github" className="mt-1">
                GitHub
              </Badge>
            )
          }
          subtitle={
            user
              ? `Review open work across your repositories. ${user.name ?? user.login} · @${user.login}${
                  settings.refreshIntervalMin > 0
                    ? ` · auto ${settings.refreshIntervalMin}m`
                    : " · auto off"
                }`
              : "Loading…"
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/">Today</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/people">People</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/repos">
                  Repos
                  {favorites.length > 0 ? (
                    <span className="tabular-nums opacity-70">
                      {favorites.length}
                    </span>
                  ) : null}
                </Link>
              </Button>
            </div>
          }
        />

        {ciFails.length > 0 ? (
          <div className="border-error/30 bg-error-container text-body-md text-on-error-container rounded-lg border px-4 py-3">
            <p className="font-medium">
              {ciFails.length} of your open PR
              {ciFails.length === 1 ? "" : "s"} have failing CI
            </p>
            <ul className="text-body-sm mt-2 space-y-1">
              {ciFails.slice(0, 4).map((hit) => (
                <li key={`${hit.pr.repo}#${hit.pr.number}`}>
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => navigate(reviewPath(hit.pr))}
                  >
                    {hit.pr.repo}#{hit.pr.number}
                  </button>
                  <span className="opacity-80"> · {hit.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <PRList
          lists={visibleLists}
          active={tab}
          onTabChange={setTab}
          loading={loading}
          error={error}
          stale={stale}
          onRefresh={() => void refresh()}
          updatedAt={updatedAt}
          onSelect={(pr) => navigate(reviewPath(pr))}
          authorLogin={authorLogin}
          authorMode={authorMode}
          onAuthorChange={onAuthorChange}
          searchItems={searchItems}
          searchLoading={searchLoading}
          searchError={searchError}
          ciFailures={ciFailureMap}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="full" className="gap-5">
      <TodayHeader
        userName={user?.name ?? null}
        userLogin={user?.login ?? ""}
        actionCount={needsMeCount}
        onRefresh={() => void onRefreshAll()}
        refreshing={loading || side.loading}
        favoritesCount={favorites.length}
      />

      <TodaySummaryCards
        needsMe={needsMeCount}
        prReview={visibleLists.review.length}
        prMine={visibleLists.mine.length}
        ciFails={ciFails.length}
        jiraCount={side.jira.length}
        jiraConnected={side.jiraConnected}
        meetingCount={side.calendar.length}
        nextMeetingLabel={nextMeetingLabel}
        googleConnected={side.googleConnected}
      />

      {ciFails.length > 0 ? (
        <div className="border-error/30 bg-error-container text-body-md text-on-error-container rounded-lg border px-4 py-3">
          <p className="font-medium">
            {ciFails.length} of your open PR
            {ciFails.length === 1 ? "" : "s"} have failing CI
          </p>
          <ul className="text-body-sm mt-2 space-y-1">
            {ciFails.slice(0, 4).map((hit) => (
              <li key={`${hit.pr.repo}#${hit.pr.number}`}>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => navigate(reviewPath(hit.pr))}
                >
                  {hit.pr.repo}#{hit.pr.number}
                </button>
                <span className="opacity-80"> · {hit.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <NeedsMeSection
            filter={sourceFilter}
            onFilterChange={(f: SourceFilter) => setSourceFilter(f)}
            reviewPrs={visibleLists.review}
            reviewedPrs={visibleLists.reviewed}
            ciHits={ciFails}
            jira={side.jira}
            gmail={side.gmail}
            jiraConnected={side.jiraConnected}
            googleConnected={side.googleConnected}
            loading={side.loading}
            prLoading={loading}
            prError={error}
            onSelectPr={(pr) => navigate(reviewPath(pr))}
            counts={sourceCounts}
          />
        </div>
        <div className="lg:col-span-5">
          <TodaySidePreviews
            calendar={side.calendar}
            gmail={side.gmail}
            jira={side.jira}
            googleConnected={side.googleConnected}
            jiraConnected={side.jiraConnected}
            calendarError={side.calendarError}
            gmailError={side.gmailError}
            jiraError={side.jiraError}
            loading={side.loading}
          />
        </div>
      </div>
    </PageShell>
  );
}
