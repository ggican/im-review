import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { DailyActivityPoint, MetricsScorecard } from "./types";

function GroupedScoreChart({
  current,
  previous,
}: {
  current: MetricsScorecard;
  previous: MetricsScorecard | null;
}) {
  const rows = [
    {
      label: "Speed",
      current: current.speed.score,
      previous: previous?.speed.score,
    },
    {
      label: "Throughput",
      current: current.throughput.score,
      previous: previous?.throughput.score,
    },
    {
      label: "Quality",
      current: current.quality.score,
      previous: previous?.quality.score,
    },
    {
      label: "Collab",
      current: current.collaboration.score,
      previous: previous?.collaboration.score,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="text-body-sm text-on-surface-variant mb-1 flex items-center justify-between">
            <span>{row.label}</span>
            <span className="font-keycap tabular-nums">
              {row.current}
              {row.previous != null ? ` / prev ${row.previous}` : ""}
            </span>
          </div>
          <div className="flex h-4 gap-1">
            <div className="bg-surface-container-high relative flex-1 overflow-hidden rounded-md">
              <div
                className="bg-primary absolute inset-y-0 left-0 rounded-md"
                style={{ width: `${row.current}%` }}
              />
            </div>
            {previous && row.previous != null ? (
              <div className="bg-surface-container-high relative flex-1 overflow-hidden rounded-md">
                <div
                  className="bg-outline-variant absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${row.previous}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <div className="text-body-sm text-on-surface-variant flex gap-3">
        <span className="inline-flex items-center gap-1">
          <span className="bg-primary h-2 w-2 rounded-sm" />
          Current
        </span>
        {previous ? (
          <span className="inline-flex items-center gap-1">
            <span className="bg-outline-variant h-2 w-2 rounded-sm" />
            Previous
          </span>
        ) : null}
      </div>
    </div>
  );
}

function polyline(
  points: number[],
  width: number,
  height: number,
  pad: number,
): string {
  const max = Math.max(1, ...points);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  return points
    .map((value, i) => {
      const x =
        pad +
        (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
      const y = pad + innerH - (value / max) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
}

function ActivityChart({ points }: { points: DailyActivityPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant py-8 text-center">
        No activity in this window.
      </p>
    );
  }

  const hasAny = points.some(
    (p) => p.created > 0 || p.merged > 0 || p.reviewed > 0,
  );
  if (!hasAny) {
    return (
      <p className="text-body-md text-on-surface-variant py-8 text-center">
        No activity in this window.
      </p>
    );
  }

  const width = 520;
  const height = 140;
  const pad = 12;
  const created = points.map((p) => p.created);
  const merged = points.map((p) => p.merged);
  const reviewed = points.map((p) => p.reviewed);
  const max = Math.max(1, ...created, ...merged, ...reviewed);

  const bars = points.map((p, i) => {
    const innerW = width - pad * 2;
    const slot = innerW / points.length;
    const x = pad + i * slot + slot * 0.15;
    const barW = Math.max(2, slot * 0.7);
    const h = (p.created / max) * (height - pad * 2);
    return { x, barW, h, created: p.created, date: p.date };
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-36 w-full"
        role="img"
        aria-label="Daily PR activity"
      >
        {bars.map((b) => (
          <rect
            key={b.date}
            x={b.x}
            y={height - pad - b.h}
            width={b.barW}
            height={b.h}
            rx="4"
            className="fill-primary"
            opacity={0.85}
          />
        ))}
        <polyline
          fill="none"
          strokeWidth="2"
          className="stroke-success"
          points={polyline(merged, width, height, pad)}
        />
        <polyline
          fill="none"
          strokeWidth="2"
          className="stroke-primary-container"
          points={polyline(reviewed, width, height, pad)}
        />
      </svg>
      <div className="text-body-sm text-on-surface-variant mt-2 flex flex-wrap justify-between gap-2">
        <span className="font-keycap">{points[0]?.date}</span>
        <span className="inline-flex items-center gap-3">
          <span>Bars: created</span>
          <span className="text-success">Line: merged</span>
          <span className="text-primary">Line: reviewed</span>
        </span>
        <span className="font-keycap">{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function MetricsCharts({
  current,
  previous,
  daily,
}: {
  current: MetricsScorecard;
  previous: MetricsScorecard | null;
  daily: DailyActivityPoint[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card padding="default">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md">
            Score vs previous period
          </CardTitle>
          <CardDescription>
            Teal bar is current window. Gray bar is the previous window of the
            same length.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupedScoreChart current={current} previous={previous} />
        </CardContent>
      </Card>
      <Card padding="default">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md">Daily activity</CardTitle>
          <CardDescription>
            PRs created each day, with merged and reviewed overlays.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityChart points={daily} />
        </CardContent>
      </Card>
    </div>
  );
}
