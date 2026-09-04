import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

import { CiHealthPanel } from "./CiHealthPanel";
import { useMetrics } from "./hooks";
import { MetricBreakdownPanel } from "./MetricBreakdownPanel";
import { MetricCard } from "./MetricCard";
import { MetricsCharts } from "./MetricsCharts";
import { MetricSuggestionsPanel } from "./MetricSuggestionsPanel";
import { MetricSummaryBanner } from "./MetricSummaryBanner";
import type {
  MetricCategory,
  MetricsAggregation,
  MetricsWindowPreset,
} from "./types";
import {
  DEFAULT_METRICS_AGGREGATION,
  DEFAULT_METRICS_WINDOW,
  METRICS_AGGREGATION_OPTIONS,
  METRICS_WINDOW_OPTIONS,
} from "./types";

type MetricsTab = "scorecard" | "suggestions" | "ci";

export function MetricsPage() {
  const [preset, setPreset] = useState<MetricsWindowPreset>(
    DEFAULT_METRICS_WINDOW,
  );
  const [aggregation, setAggregation] = useState<MetricsAggregation>(
    DEFAULT_METRICS_AGGREGATION,
  );
  const {
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
  } = useMetrics(true, preset, aggregation);
  const [activeCategory, setActiveCategory] = useState<MetricCategory>("speed");
  const [tab, setTab] = useState<MetricsTab>("scorecard");

  useEffect(() => {
    document.title = "Metrics · IM Review";
  }, []);

  const activeSubscore = useMemo(() => {
    if (!scorecard) return null;
    switch (activeCategory) {
      case "speed":
        return scorecard.speed;
      case "quality":
        return scorecard.quality;
      case "throughput":
        return scorecard.throughput;
      case "collaboration":
        return scorecard.collaboration;
      default:
        return scorecard.speed;
    }
  }, [scorecard, activeCategory]);

  const aggregationLabel =
    METRICS_AGGREGATION_OPTIONS.find((o) => o.value === aggregation)?.label ??
    "Average";

  const windowLabel = scorecard
    ? `${scorecard.window.label} (${scorecard.window.from} → ${scorecard.window.to})`
    : (METRICS_WINDOW_OPTIONS.find((o) => o.value === preset)?.label ??
      "7 days");

  const previousLabel = previousScorecard
    ? `${previousScorecard.window.from} → ${previousScorecard.window.to}`
    : null;

  const tabs: Array<{ id: MetricsTab; label: string }> = [
    { id: "scorecard", label: "Scorecard" },
    {
      id: "suggestions",
      label:
        suggestions.length > 0
          ? `Suggestions (${suggestions.length})`
          : "Suggestions",
    },
    { id: "ci", label: "CI Health" },
  ];

  return (
    <PageShell width="lg">
      <PageHeader
        title="Metrics"
        subtitle="Engineering scorecard from your GitHub PR activity"
        backTo="/"
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
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

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="min-w-[11rem] flex-1 sm:flex-none">
          <p className="mb-1 text-xs font-medium text-neutral-500">
            Aggregation
          </p>
          <Select
            value={aggregation}
            onValueChange={(value) =>
              setAggregation(value as MetricsAggregation)
            }
          >
            <SelectTrigger aria-label="Aggregation">
              <SelectValue placeholder="Choose aggregation" />
            </SelectTrigger>
            <SelectContent>
              {METRICS_AGGREGATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-neutral-500">
            Time window
          </p>
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="Time window"
          >
            {METRICS_WINDOW_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={preset === option.value ? "default" : "outline"}
                onClick={() => setPreset(option.value)}
                disabled={loading && preset === option.value}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Metrics sections"
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

      {loading && !scorecard ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing metrics from GitHub…
        </div>
      ) : null}

      {scorecard && tab === "scorecard" ? (
        <div className="space-y-6">
          <MetricSummaryBanner
            overall={scorecard.overall}
            login={login}
            windowLabel={windowLabel}
            previousLabel={previousLabel}
            aggregationLabel={aggregationLabel}
            generatedAt={updatedAt}
            trend={trends?.overall ?? null}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              subscore={scorecard.speed}
              trend={trends?.speed}
              active={activeCategory === "speed"}
              onSelect={() => setActiveCategory("speed")}
            />
            <MetricCard
              subscore={scorecard.throughput}
              trend={trends?.throughput}
              active={activeCategory === "throughput"}
              onSelect={() => setActiveCategory("throughput")}
            />
            <MetricCard
              subscore={scorecard.quality}
              trend={trends?.quality}
              active={activeCategory === "quality"}
              onSelect={() => setActiveCategory("quality")}
            />
            <MetricCard
              subscore={scorecard.collaboration}
              trend={trends?.collaboration}
              active={activeCategory === "collaboration"}
              onSelect={() => setActiveCategory("collaboration")}
            />
          </div>

          <MetricsCharts
            current={scorecard}
            previous={previousScorecard}
            daily={daily}
          />

          <MetricBreakdownPanel subscore={activeSubscore} />
        </div>
      ) : null}

      {scorecard && tab === "suggestions" ? (
        <MetricSuggestionsPanel suggestions={suggestions} />
      ) : null}

      {scorecard && tab === "ci" ? (
        <CiHealthPanel
          summary={ciHealth}
          loading={loading}
          windowLabel={scorecard.window.label}
        />
      ) : null}

      {!loading && !error && !scorecard ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          No metrics available yet.
        </p>
      ) : null}
    </PageShell>
  );
}
