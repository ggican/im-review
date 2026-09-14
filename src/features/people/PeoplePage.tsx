import { Loader2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchGithubUser, searchGithubUsers } from "@/features/people/api";
import { normalizeGithubLogin } from "@/features/people/login";
import type { FavoriteUser } from "@/features/people/types";
import { fetchOpenPrsByAuthor } from "@/features/pr/api";
import type { PullRequest } from "@/features/pr/types";
import { cn } from "@/lib/cn";
import {
  getFavoriteUsers,
  MAX_FAVORITE_USERS,
  toggleFavoriteUser,
} from "@/lib/settings";
import { relativeTime } from "@/lib/time";
import { useFavoriteUsers } from "@/lib/use-settings";

type Tab = "favorites" | "search";

function reviewPath(pr: PullRequest): string {
  const [owner, name] = pr.repo.split("/");
  return `/review/${owner}/${name}/${pr.number}`;
}

function PersonRow({
  user,
  favorited,
  onOpen,
}: {
  user: Omit<FavoriteUser, "favoritedAt"> & { favoritedAt?: string };
  favorited: boolean;
  onOpen: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2.5 last:border-b-0 dark:border-neutral-800">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={onOpen}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <span className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {user.name ?? user.login}
          </span>
          <span className="block truncate text-xs text-neutral-500">
            @{user.login}
          </span>
        </span>
      </button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={favorited ? "Remove favorite person" : "Favorite person"}
        aria-pressed={favorited}
        onClick={() => {
          if (!favorited && getFavoriteUsers().length >= MAX_FAVORITE_USERS) {
            toast.error(`Favorite people limit is ${MAX_FAVORITE_USERS}`);
            return;
          }
          toggleFavoriteUser({
            login: user.login,
            name: user.name,
            avatarUrl: user.avatarUrl,
            htmlUrl: user.htmlUrl,
          });
        }}
      >
        <Star
          className={cn(
            "h-4 w-4",
            favorited && "fill-amber-400 text-amber-500",
          )}
        />
      </Button>
    </li>
  );
}

export function PeoplePage() {
  const navigate = useNavigate();
  const favorites = useFavoriteUsers();
  const [tab, setTab] = useState<Tab>("favorites");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Omit<FavoriteUser, "favoritedAt">[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [prLoading, setPrLoading] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);

  const favSet = useMemo(
    () => new Set(favorites.map((u) => u.login.toLowerCase())),
    [favorites],
  );

  useEffect(() => {
    document.title = "People · IM Review";
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (tab !== "search" || q.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearching(true);
      void searchGithubUsers(q)
        .then(setResults)
        .catch((err) => toast.error(String(err)))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(t);
  }, [query, tab]);

  useEffect(() => {
    if (!selected) {
      setPrs([]);
      setPrError(null);
      return;
    }
    let cancelled = false;
    setPrLoading(true);
    setPrError(null);
    void fetchOpenPrsByAuthor(selected)
      .then((list) => {
        if (!cancelled) setPrs(list);
      })
      .catch((err) => {
        if (!cancelled) setPrError(String(err));
      })
      .finally(() => {
        if (!cancelled) setPrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function addByLogin() {
    const login = normalizeGithubLogin(query);
    if (!login) {
      toast.error("Enter a valid GitHub login");
      return;
    }
    try {
      const user = await fetchGithubUser(login);
      if (
        getFavoriteUsers().length >= MAX_FAVORITE_USERS &&
        !favSet.has(login.toLowerCase())
      ) {
        toast.error(`Favorite people limit is ${MAX_FAVORITE_USERS}`);
        return;
      }
      toggleFavoriteUser(user);
      toast.success(`Favorited @${user.login}`);
      setTab("favorites");
    } catch {
      toast.error(`GitHub user @${login} not found`);
    }
  }

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/"
        title="People"
        subtitle={`${favorites.length} favorite${favorites.length === 1 ? "" : "s"} · star authors, then click to list their open PRs`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={
            tab === "search" ? "Search GitHub users…" : "Add by login…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === "favorites" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void addByLogin()}
          >
            Add
          </Button>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="People lists"
        className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {(
          [
            { id: "favorites", label: `Favorites (${favorites.length})` },
            { id: "search", label: "Search" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              tab === item.id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          {tab === "favorites" ? (
            favorites.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-neutral-500">
                No favorite people yet. Star an author on the dashboard or
                search.
              </p>
            ) : (
              <ul>
                {favorites.map((user) => (
                  <PersonRow
                    key={user.login}
                    user={user}
                    favorited
                    onOpen={() => setSelected(user.login)}
                  />
                ))}
              </ul>
            )
          ) : searching && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-neutral-500">
              {query.trim().length < 2
                ? "Type at least 2 characters."
                : "No users match."}
            </p>
          ) : (
            <ul>
              {results.map((user) => (
                <PersonRow
                  key={user.login}
                  user={user}
                  favorited={favSet.has(user.login.toLowerCase())}
                  onOpen={() => setSelected(user.login)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          {!selected ? (
            <p className="px-4 py-12 text-center text-sm text-neutral-500">
              Select a person to list their open PRs.
            </p>
          ) : prLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading PRs by @{selected}…
            </div>
          ) : prError ? (
            <p className="px-4 py-8 text-center text-sm text-red-600">
              {prError}
            </p>
          ) : prs.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-neutral-500">
              No open PRs by @{selected}.
            </p>
          ) : (
            <ul>
              {prs.map((pr) => (
                <li key={`${pr.repo}#${pr.number}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 border-b border-neutral-200 px-3 py-2.5 text-left last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    onClick={() => navigate(reviewPath(pr))}
                  >
                    <span className="text-sm font-medium">{pr.title}</span>
                    <span className="font-mono text-xs text-neutral-500">
                      {pr.repo}#{pr.number} · {relativeTime(pr.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
