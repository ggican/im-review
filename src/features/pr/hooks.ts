import { useCallback, useEffect, useRef, useState } from "react";

import { useFavorites, useSettings } from "@/lib/use-settings";

import {
  fetchAllOpenPrs,
  fetchAssignedPrs,
  fetchMyOpenPrs,
  fetchOpenPullsForRepos,
  fetchReviewRequestedPrs,
} from "./api";
import {
  getPrCache,
  getPrCacheUpdatedAt,
  getPrTabUpdatedAt,
  setPrCacheTab,
} from "./pr-cache";
import { isGithubRateLimitError } from "./rate-limit";
import type { PrLists, PrTab, PullRequest } from "./types";

async function fetchTab(
  tab: PrTab,
  favoriteRepos: string[],
): Promise<PullRequest[]> {
  switch (tab) {
    case "all":
      return fetchAllOpenPrs();
    case "favorites":
      return fetchOpenPullsForRepos(favoriteRepos, 2);
    case "assigned":
      return fetchAssignedPrs();
    case "review":
      return fetchReviewRequestedPrs();
    case "reviewed":
      // Local history only — filled by dashboard mergeLocalReviews.
      return [];
    case "mine":
      return fetchMyOpenPrs();
  }
}

/**
 * Loads PR lists **per active tab** (lazy).
 * Successful fetches are persisted to localStorage; on GitHub errors we keep
 * the last cached list so the UI still works offline / under rate limits.
 */
export function useMyPRs(enabled: boolean, activeTab: PrTab) {
  const { refreshIntervalMin } = useSettings();
  const favorites = useFavorites();
  const [lists, setLists] = useState<PrLists>(() => getPrCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(() =>
    getPrCacheUpdatedAt(),
  );
  const loadedRef = useRef<Set<PrTab>>(new Set());
  const favoritesKey = favorites.join(",");

  const loadTab = useCallback(
    async (tab: PrTab, force = false) => {
      if (!enabled) return;
      if (!force && loadedRef.current.has(tab)) return;

      // Already reviewed = local history only (no GitHub list fetch).
      if (tab === "reviewed") {
        loadedRef.current.add(tab);
        setLoading(false);
        setError(null);
        setStale(false);
        setLists(getPrCache());
        return;
      }

      const cachedCount = getPrCache()[tab]?.length ?? 0;
      setLoading(true);
      setError(null);
      if (cachedCount === 0) setStale(false);

      try {
        const items = await fetchTab(tab, favorites);
        setPrCacheTab(tab, items);
        setLists(getPrCache());
        loadedRef.current.add(tab);
        setUpdatedAt(getPrTabUpdatedAt(tab) ?? new Date());
        setError(null);
        setStale(false);
      } catch (err) {
        const cached = getPrCache()[tab] ?? [];
        setLists(getPrCache());
        const when = getPrTabUpdatedAt(tab) ?? getPrCacheUpdatedAt();
        if (when) setUpdatedAt(when);

        if (cached.length > 0) {
          setStale(true);
          loadedRef.current.add(tab);
          if (isGithubRateLimitError(err)) {
            setError(
              "GitHub rate limit — menampilkan list tersimpan. Tunggu beberapa menit lalu Refresh.",
            );
          } else {
            setError(
              `Gagal update dari GitHub — menampilkan list tersimpan. (${String(err)})`,
            );
          }
        } else if (isGithubRateLimitError(err)) {
          setStale(false);
          setError(
            "GitHub secondary rate limit — tunggu beberapa menit, lalu Refresh. Belum ada cache untuk tab ini.",
          );
        } else {
          setStale(false);
          setError(String(err));
        }
      } finally {
        setLoading(false);
      }
    },
    [enabled, favorites],
  );

  const refresh = useCallback(async () => {
    loadedRef.current.delete(activeTab);
    await loadTab(activeTab, true);
  }, [activeTab, loadTab]);

  useEffect(() => {
    loadedRef.current.delete("favorites");
  }, [favoritesKey]);

  useEffect(() => {
    void loadTab(activeTab);
  }, [activeTab, loadTab, favoritesKey]);

  useEffect(() => {
    if (!enabled || refreshIntervalMin <= 0) return;
    const ms = refreshIntervalMin * 60_000;
    const id = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, refresh, refreshIntervalMin]);

  const count = (tab: PrTab) => lists[tab].length;

  return { lists, loading, error, stale, updatedAt, refresh, count };
}
