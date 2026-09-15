import { Loader2, RefreshCw, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
import { useFavorites } from "@/lib/use-settings";

import { useRepos } from "./hooks";
import { RepoOpenBranchesPanel } from "./RepoOpenBranchesPanel";
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
  const [selected, setSelected] = useState<Repo | null>(null);

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
    document.title = selected
      ? `${selected.fullName} · Repos · IM Review`
      : "Repos · IM Review";
  }, [selected]);

  if (selected) {
    return (
      <PageShell width="lg" className="gap-5">
        <RepoOpenBranchesPanel
          repo={selected}
          onBack={() => setSelected(null)}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/"
        title="Repositories"
        subtitle={`${favorites.length} favorite${favorites.length === 1 ? "" : "s"} · ${repos.length} loaded · click a repo for open PRs`}
        leading={
          <Badge variant="github" className="mt-1">
            Repos
          </Badge>
        }
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

      <Card padding="default" className="border-stream-github-border/80">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md">Browse repositories</CardTitle>
          <CardDescription>
            Favorites filter the dashboard. Star repos here or restore defaults
            in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search repos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label="Search repos"
            className="max-w-md"
          />
          <TabsList aria-label="Repository lists" className="h-auto flex-wrap">
            {tabs.map((item) => (
              <TabsTrigger
                key={item.id}
                id={`repos-tab-${item.id}`}
                aria-controls="repos-tab-panel"
                active={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </CardContent>
      </Card>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <TabsPanel id="repos-tab-panel" aria-labelledby={`repos-tab-${tab}`}>
      {tab === "favorites" ? (
        <Card padding="none" className="overflow-hidden border-warning/30">
          <div className="flex items-center gap-1.5 border-b border-border bg-warning-container/40 px-3 py-2">
            <Star className={cn("h-3.5 w-3.5", favoriteStarClass(true))} />
            <h2 className="text-label-sm tracking-wide text-on-warning-container uppercase">
              Favorite repos
            </h2>
          </div>
          <div className="max-h-[min(36rem,65vh)] overflow-y-auto">
            {visibleFavorites.length === 0 ? (
              <div className="px-4 py-8 text-center text-body-md text-on-surface-variant">
                {query.trim()
                  ? "No favorite repos match your search."
                  : "No favorite repos. Restore defaults in Settings."}
              </div>
            ) : (
              <ul>
                {visibleFavorites.map((repo) => (
                  <RepoRow
                    key={`fav-${repo.fullName}`}
                    repo={repo}
                    favorited
                    onOpenDetail={setSelected}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}

      {tab === "all" ? (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-border bg-surface-container-low/40 px-3 py-2">
            <h2 className="text-label-sm tracking-wide text-on-surface-variant uppercase">
              All repos
            </h2>
          </div>
          <div className="max-h-[min(36rem,65vh)] overflow-y-auto">
            {loading && repos.length === 0 ? (
              <LoadingBlock embedded>Loading repositories…</LoadingBlock>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-12 text-center text-body-md text-on-surface-variant">
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
                    onOpenDetail={setSelected}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}
      </TabsPanel>
    </PageShell>
  );
}
