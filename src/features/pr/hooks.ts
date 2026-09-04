import { useCallback, useEffect, useState } from "react";

import { useSettings } from "@/lib/use-settings";

import {
  fetchAssignedPrs,
  fetchMyOpenPrs,
  fetchReviewRequestedPrs,
} from "./api";
import { setPrCache } from "./pr-cache";
import type { PrLists, PrTab } from "./types";

const EMPTY: PrLists = { assigned: [], review: [], mine: [] };

export function useMyPRs(enabled: boolean) {
  const { refreshIntervalMin } = useSettings();
  const [lists, setLists] = useState<PrLists>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [assigned, review, mine] = await Promise.all([
        fetchAssignedPrs(),
        fetchReviewRequestedPrs(),
        fetchMyOpenPrs(),
      ]);
      const next = { assigned, review, mine };
      setLists(next);
      setPrCache(next);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || refreshIntervalMin <= 0) return;
    const ms = refreshIntervalMin * 60_000;
    const id = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, refresh, refreshIntervalMin]);

  const count = (tab: PrTab) => lists[tab].length;

  return { lists, loading, error, updatedAt, refresh, count };
}
