import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { fetchGithubUser, searchGithubUsers } from "@/features/people/api";
import { normalizeGithubLogin } from "@/features/people/login";
import type { FavoriteUser } from "@/features/people/types";
import { fetchOpenPrsByAuthor } from "@/features/pr/api";
import type { PullRequest } from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
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

function initials(user: { name?: string | null; login: string }): string {
  const source = (user.name ?? user.login).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function PersonRow({
  user,
  favorited,
  selected,
  onOpen,
}: {
  user: Omit<FavoriteUser, "favoritedAt"> & { favoritedAt?: string };
  favorited: boolean;
  selected?: boolean;
  onOpen: () => void;
}) {
  return (
    <li className="border-border border-b last:border-b-0">
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5",
          selected && "bg-stream-github/40",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onOpen}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="border-border h-8 w-8 rounded-full border"
            />
          ) : (
            <span
              className="bg-stream-github font-keycap text-stream-github-fg flex h-8 w-8 items-center justify-center rounded-full text-[10px]"
              aria-hidden
            >
              {initials(user)}
            </span>
          )}
          <span className="min-w-0">
            <span className="text-body-md text-on-surface block truncate font-medium">
              {user.name ?? user.login}
            </span>
            <span className="text-on-surface-variant block truncate font-mono text-xs">
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
          <Star className={cn("h-4 w-4", favoriteStarClass(favorited))} />
        </Button>
      </div>
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
        leading={
          <Badge variant="github" className="mt-1">
            People
          </Badge>
        }
      />

      <Card padding="default" className="border-stream-github-border/80">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md">Find authors</CardTitle>
          <CardDescription>
            Favorites stay local. Search uses GitHub user search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-md"
              placeholder={
                tab === "search" ? "Search GitHub users…" : "Add by login…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={
                tab === "search" ? "Search GitHub users" : "Add by login"
              }
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

          <TabsList aria-label="People lists" className="h-auto flex-wrap">
            <TabsTrigger
              id="people-tab-favorites"
              aria-controls="people-tab-panel"
              active={tab === "favorites"}
              onClick={() => setTab("favorites")}
            >
              Favorites ({favorites.length})
            </TabsTrigger>
            <TabsTrigger
              id="people-tab-search"
              aria-controls="people-tab-panel"
              active={tab === "search"}
              onClick={() => setTab("search")}
            >
              Search
            </TabsTrigger>
          </TabsList>
        </CardContent>
      </Card>

      <TabsPanel
        id="people-tab-panel"
        aria-labelledby={`people-tab-${tab}`}
        className="grid gap-4 lg:grid-cols-2"
      >
        <Card padding="none" className="overflow-hidden">
          {tab === "favorites" ? (
            favorites.length === 0 ? (
              <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
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
                    selected={selected === user.login}
                    onOpen={() => setSelected(user.login)}
                  />
                ))}
              </ul>
            )
          ) : searching && results.length === 0 ? (
            <LoadingBlock embedded>Searching…</LoadingBlock>
          ) : results.length === 0 ? (
            <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
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
                  selected={selected === user.login}
                  onOpen={() => setSelected(user.login)}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="border-border bg-surface-container-low/40 border-b px-3 py-2">
            <h2 className="text-label-sm text-on-surface-variant tracking-wide uppercase">
              Open PRs
              {selected ? (
                <span className="ml-2 font-mono tracking-normal normal-case">
                  @{selected}
                </span>
              ) : null}
            </h2>
          </div>
          {!selected ? (
            <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
              Select a person to list their open PRs.
            </p>
          ) : prLoading ? (
            <LoadingBlock embedded>Loading PRs by @{selected}…</LoadingBlock>
          ) : prError ? (
            <ErrorBlock className="m-3">{prError}</ErrorBlock>
          ) : prs.length === 0 ? (
            <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
              No open PRs by @{selected}.
            </p>
          ) : (
            <ul>
              {prs.map((pr) => (
                <li
                  key={`${pr.repo}#${pr.number}`}
                  className="border-border border-b last:border-b-0"
                >
                  <button
                    type="button"
                    className="hover:bg-surface-container-low/60 flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left"
                    onClick={() => navigate(reviewPath(pr))}
                  >
                    <span className="text-body-md text-on-surface font-medium">
                      {pr.title}
                    </span>
                    <span className="text-on-surface-variant font-mono text-xs">
                      {pr.repo}#{pr.number} · {relativeTime(pr.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </TabsPanel>
    </PageShell>
  );
}
