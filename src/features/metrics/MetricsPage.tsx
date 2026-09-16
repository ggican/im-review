import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";

import { CiHealthPanel } from "./CiHealthPanel";
import { useMetrics } from "./hooks";
import { MetricBreakdownPanel } from "./MetricBreakdownPanel";
import { MetricCard } from "./MetricCard";
import { MetricsCharts } from "./MetricsCharts";
import { MetricSuggestionsPanel } from "./MetricSuggestionsPanel";
import { MetricSummaryBanner } from "./MetricSummaryBanner";
import { MetricSummaryCards } from "./MetricSummaryCards";
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
    <PageShell width="full" className="gap-5">
      <PageHeader
        title="Metrics"
        subtitle="Engineering scorecard from your GitHub PR activity"
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

      <Card padding="default" className="border-stream-github-border/80">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md">Filters</CardTitle>
          <CardDescription>
            Aggregation and window apply to scorecard calculations only — CI is
            informational.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[11rem] flex-1 sm:flex-none">
              <p className="text-label-sm text-on-surface-variant mb-1">
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
              <p className="text-label-sm text-on-surface-variant mb-1">
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
                    variant={preset === option.value ? "accent" : "outline"}
                    onClick={() => setPreset(option.value)}
                    disabled={loading && preset === option.value}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TabsList aria-label="Metrics sections" className="h-auto flex-wrap">
        {tabs.map((item) => (
          <TabsTrigger
            key={item.id}
            id={`metrics-tab-${item.id}`}
            aria-controls="metrics-tab-panel"
            active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {loading && !scorecard ? (
        <LoadingBlock>Computing metrics from GitHub…</LoadingBlock>
      ) : null}

      <TabsPanel
        id="metrics-tab-panel"
        aria-labelledby={`metrics-tab-${tab}`}
        className="space-y-5"
      >
        {scorecard && tab === "scorecard" ? (
          <div className="space-y-5">
            <MetricSummaryBanner
              overall={scorecard.overall}
              login={login}
              windowLabel={windowLabel}
              previousLabel={previousLabel}
              aggregationLabel={aggregationLabel}
              generatedAt={updatedAt}
              trend={trends?.overall ?? null}
            />

            <MetricSummaryCards scorecard={scorecard} ciHealth={ciHealth} />

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
          <Card padding="default">
            <p className="text-body-md text-on-surface-variant py-12 text-center">
              No metrics available yet.
            </p>
          </Card>
        ) : null}
      </TabsPanel>
    </PageShell>
  );
}
