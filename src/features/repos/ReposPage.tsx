import { Loader2, RefreshCw, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/lib/use-settings";

import { useRepos } from "./hooks";
import { RepoRow } from "./RepoRow";
import type { Repo } from "./types";

type ReposTab = "favorites" | "all";

function stubFavoriteRepo(fullName: string): Repo {
  // Stable negative id from name so React keys stay unique.
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash * 31 + fullName.charCodeAt(i)) | 0;
  }
  return {
    id: -Math.abs(hash || 1),
    fullName,
    description: "Favorite repo (may not appear in GitHub /user/repos yet)",
    private: true,
    htmlUrl: `https://github.com/${fullName}`,
    updatedAt: new Date(0).toISOString(),
    language: null,
  };
}

export function ReposPage() {
  const favorites = useFavorites();
  const favSet = new Set(favorites);
  const { filtered, loading, error, query, setQuery, refresh, repos } =
    useRepos(true);
  const [tab, setTab] = useState<ReposTab>("favorites");

  const favoriteRows = useMemo(() => {
    const byName = new Map(repos.map((r) => [r.fullName, r]));
    return favorites.map(
      (fullName) => byName.get(fullName) ?? stubFavoriteRepo(fullName),
    );
  }, [favorites, repos]);

  const sorted = [...filtered].sort((a, b) => {
    const af = favSet.has(a.fullName) ? 0 : 1;
    const bf = favSet.has(b.fullName) ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.fullName.localeCompare(b.fullName);
  });

  const q = query.trim().toLowerCase();
  const visibleFavorites = q
    ? favoriteRows.filter((r) => r.fullName.toLowerCase().includes(q))
    : favoriteRows;

  const tabs: Array<{ id: ReposTab; label: string }> = [
    {
      id: "favorites",
      label:
        visibleFavorites.length > 0
          ? `Favorites (${visibleFavorites.length})`
          : "Favorites",
    },
    {
      id: "all",
      label: sorted.length > 0 ? `All repos (${sorted.length})` : "All repos",
    },
  ];

  useEffect(() => {
    document.title = "Repos · IM Review";
  }, []);

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/"
        title="Repos"
        subtitle={`${favorites.length} favorite${favorites.length === 1 ? "" : "s"} · ${repos.length} loaded`}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <Input
        placeholder="Search repos…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div
        role="tablist"
        aria-label="Repository lists"
        className="inline-flex flex-wrap rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {tab === "favorites" ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            Favorite repos
          </h2>
          <div className="max-h-[min(36rem,65vh)] overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
            {visibleFavorites.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                No favorite repos. Restore defaults in Settings.
              </div>
            ) : (
              <ul>
                {visibleFavorites.map((repo) => (
                  <RepoRow key={`fav-${repo.fullName}`} repo={repo} favorited />
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "all" ? (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            All repos
          </h2>
          <div className="max-h-[min(36rem,65vh)] overflow-y-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            {loading && repos.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading repositories…
              </div>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-16 text-center text-sm text-neutral-500">
                {query.trim()
                  ? "No repos match your search."
                  : "No repositories found."}
              </div>
            ) : (
              <ul>
                {sorted.map((repo) => (
                  <RepoRow
                    key={repo.id}
                    repo={repo}
                    favorited={favSet.has(repo.fullName)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
