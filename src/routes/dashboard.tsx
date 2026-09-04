import { BarChart3, BookMarked, LogOut, Settings } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { BrandMark, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { type CiWatchHit, scanMineCiFailures } from "@/features/pr/ci-watch";
import { useMyPRs } from "@/features/pr/hooks";
import { PRList } from "@/features/pr/PRList";
import type { PrLists, PrTab, PullRequest } from "@/features/pr/types";
import {
  latestReviewsByPr,
  prKey,
  savedReviewToPullRequest,
} from "@/features/pr/types";
import { api, type GithubUser } from "@/lib/api";
import { updateDesktopAlerts } from "@/lib/desktop-alerts";
import {
  countNewPrs,
  ensureLastSeenSeeded,
  getLastSeenSnapshot,
  subscribeLastSeen,
} from "@/lib/seen";
import { getSettings, saveSettings } from "@/lib/settings";
import { useFavorites, useSavedReviews, useSettings } from "@/lib/use-settings";

function filterLists(
  lists: PrLists,
  favorites: string[],
  only: boolean,
): PrLists {
  if (!only || favorites.length === 0) return lists;
  const set = new Set(favorites);
  const pick = (items: PullRequest[]) => items.filter((pr) => set.has(pr.repo));
  return {
    assigned: pick(lists.assigned),
    review: pick(lists.review),
    mine: pick(lists.mine),
  };
}

/** Annotate live PRs + keep locally reviewed ones visible on Review tab. */
function mergeLocalReviews(
  lists: PrLists,
  saved: ReturnType<typeof latestReviewsByPr>,
  favoriteRepos: string[],
  favoritesOnly: boolean,
): PrLists {
  const favSet = new Set(favoriteRepos);
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

  const assigned = annotate(lists.assigned);
  const mine = annotate(lists.mine);
  const reviewLive = annotate(lists.review);

  const present = new Set(
    [...assigned, ...mine, ...reviewLive].map((pr) =>
      prKey(pr.repo, pr.number),
    ),
  );

  const kept: PullRequest[] = [];
  for (const local of saved.values()) {
    const key = prKey(local.repo, local.prNumber);
    if (present.has(key)) continue;
    if (favoritesOnly && favSet.size > 0 && !favSet.has(local.repo)) continue;
    kept.push(savedReviewToPullRequest(local));
  }

  // Reviewed-from-app rows stay on Review tab (GitHub drops review-requested).
  const review = [
    ...reviewLive.filter((pr) => !pr.localReviewEvent),
    ...reviewLive.filter((pr) => pr.localReviewEvent),
    ...kept,
  ];

  return { assigned, review, mine };
}

function reviewPath(pr: PullRequest): string {
  const [owner, name] = pr.repo.split("/");
  return `/review/${owner}/${name}/${pr.number}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const favorites = useFavorites();
  const savedReviews = useSavedReviews();
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );
  const [user, setUser] = useState<GithubUser | null>(null);
  const [tab, setTab] = useState<PrTab>("review");
  const [ciFails, setCiFails] = useState<CiWatchHit[]>([]);
  const ready = Boolean(user);
  const { lists, loading, error, updatedAt, refresh } = useMyPRs(ready);

  const visibleLists = useMemo(() => {
    const filtered = filterLists(lists, favorites, settings.favoritesOnly);
    return mergeLocalReviews(
      filtered,
      latestReviewsByPr(savedReviews),
      favorites,
      settings.favoritesOnly,
    );
  }, [lists, favorites, settings.favoritesOnly, savedReviews]);

  const newCount = useMemo(() => {
    return (
      countNewPrs(visibleLists.assigned, lastSeen) +
      countNewPrs(visibleLists.review, lastSeen) +
      countNewPrs(visibleLists.mine, lastSeen)
    );
  }, [visibleLists, lastSeen]);

  useEffect(() => {
    document.title = newCount > 0 ? `(${newCount}) IM Review` : "IM Review";
  }, [newCount]);

  useEffect(() => {
    ensureLastSeenSeeded();
  }, []);

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

  async function onLogout() {
    await api.deleteToken();
    toast.success("Signed out");
    navigate("/onboarding", { replace: true });
  }

  function setFavoritesOnly(value: boolean) {
    saveSettings({ ...getSettings(), favoritesOnly: value });
  }

  return (
    <PageShell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <div className="hidden h-6 w-px bg-neutral-200 sm:block dark:bg-neutral-800" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {user?.name ?? user?.login ?? "…"}
            </div>
            <div className="truncate text-xs text-neutral-500">
              {user ? `@${user.login}` : "Loading…"}
              {settings.refreshIntervalMin > 0
                ? ` · auto ${settings.refreshIntervalMin}m`
                : " · auto off"}
              <span className="ml-1.5 hidden text-neutral-400 sm:inline">
                · ⌘K
              </span>
            </div>
          </div>
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="ml-1 h-9 w-9 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-800"
            />
          ) : (
            <div className="ml-1 h-9 w-9 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/metrics">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/repos">
              <BookMarked className="h-4 w-4" />
              Repos
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      {ciFails.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">
            {ciFails.length} of your open PR
            {ciFails.length === 1 ? "" : "s"} have failing CI
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {ciFails.slice(0, 4).map((hit) => (
              <li key={`${hit.pr.repo}#${hit.pr.number}`}>
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-red-950 dark:hover:text-red-100"
                  onClick={() => navigate(reviewPath(hit.pr))}
                >
                  {hit.pr.repo}#{hit.pr.number}
                </button>
                <span className="text-red-600/80 dark:text-red-400/80">
                  {" "}
                  · {hit.description}
                </span>
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
        onRefresh={() => void refresh()}
        updatedAt={updatedAt}
        onSelect={(pr) => navigate(reviewPath(pr))}
        favoritesOnly={settings.favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        favoriteCount={favorites.length}
      />
    </PageShell>
  );
}
