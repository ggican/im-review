import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchMyOpenPrs, fetchReviewRequestedPrs } from "@/features/pr/api";
import type { PullRequest } from "@/features/pr/types";
import { api } from "@/lib/api";

import { buildDailyActivity, fetchEngineerMetrics } from "./fetch";
import { buildCiHealthSummary, computeScorecard, computeTrends } from "./score";
import { buildMetricSuggestions } from "./suggestions";
import type {
  CiHealthSummary,
  DailyActivityPoint,
  EngineerMetricsRaw,
  MetricsAggregation,
  MetricsScorecard,
  MetricsTrends,
  MetricSuggestion,
  MetricsWindowPreset,
} from "./types";
import { DEFAULT_METRICS_AGGREGATION, DEFAULT_METRICS_WINDOW } from "./types";

export function useMetrics(
  enabled: boolean,
  preset: MetricsWindowPreset = DEFAULT_METRICS_WINDOW,
  aggregation: MetricsAggregation = DEFAULT_METRICS_AGGREGATION,
) {
  const [raw, setRaw] = useState<EngineerMetricsRaw | null>(null);
  const [previousRaw, setPreviousRaw] = useState<EngineerMetricsRaw | null>(
    null,
  );
  const [reviewRequested, setReviewRequested] = useState<PullRequest[]>([]);
  const [myOpenPrs, setMyOpenPrs] = useState<PullRequest[]>([]);
  const [ciHealth, setCiHealth] = useState<CiHealthSummary | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    setRaw(null);
    setPreviousRaw(null);
    setCiHealth(null);
    setReviewRequested([]);
    setMyOpenPrs([]);
    try {
      const user = await api.validateToken();
      setLogin(user.login);
      const [data, reviewQueue, openMine] = await Promise.all([
        fetchEngineerMetrics(user.login, { preset }),
        fetchReviewRequestedPrs().catch(() => [] as PullRequest[]),
        fetchMyOpenPrs().catch(() => [] as PullRequest[]),
      ]);
      setRaw(data.current);
      setPreviousRaw(data.previous);
      setReviewRequested(reviewQueue);
      setMyOpenPrs(openMine);
      setCiHealth(buildCiHealthSummary(data.current.authored));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [enabled, preset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scorecard = useMemo<MetricsScorecard | null>(
    () => (raw ? computeScorecard(raw, aggregation) : null),
    [raw, aggregation],
  );

  const previousScorecard = useMemo<MetricsScorecard | null>(
    () => (previousRaw ? computeScorecard(previousRaw, aggregation) : null),
    [previousRaw, aggregation],
  );

  const trends = useMemo<MetricsTrends | null>(
    () => (scorecard ? computeTrends(scorecard, previousScorecard) : null),
    [scorecard, previousScorecard],
  );

  const daily = useMemo<DailyActivityPoint[]>(
    () =>
      raw ? buildDailyActivity(raw.window, raw.authored, raw.reviewed) : [],
    [raw],
  );

  const suggestions = useMemo<MetricSuggestion[]>(() => {
    if (!scorecard || !raw) return [];
    return buildMetricSuggestions({
      scorecard,
      raw,
      reviewRequested,
      myOpenPrs,
    });
  }, [scorecard, raw, reviewRequested, myOpenPrs]);

  return {
    raw,
    scorecard,
    previousScorecard,
    trends,
    daily,
    suggestions,
    ciHealth,
    login,
    loading,
    error,
    updatedAt,
    refresh,
  };
}
