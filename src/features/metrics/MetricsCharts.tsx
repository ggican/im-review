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
      previous: previous?.speed.score ?? 0,
    },
    {
      label: "Throughput",
      current: current.throughput.score,
      previous: previous?.throughput.score ?? 0,
    },
    {
      label: "Quality",
      current: current.quality.score,
      previous: previous?.quality.score ?? 0,
    },
    {
      label: "Collab",
      current: current.collaboration.score,
      previous: previous?.collaboration.score ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
            <span>{row.label}</span>
            <span className="tabular-nums">
              {row.current}
              {previous ? ` / prev ${row.previous}` : ""}
            </span>
          </div>
          <div className="flex h-4 gap-1">
            <div className="relative flex-1 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-neutral-900 dark:bg-neutral-100"
                style={{ width: `${row.current}%` }}
              />
            </div>
            {previous ? (
              <div className="relative flex-1 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-neutral-400 dark:bg-neutral-600"
                  style={{ width: `${row.previous}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <div className="flex gap-3 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-neutral-900 dark:bg-neutral-100" />
          Current
        </span>
        {previous ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-neutral-400" />
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
      <p className="py-8 text-center text-sm text-neutral-500">
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
            className="fill-neutral-900 dark:fill-neutral-100"
            opacity={0.85}
          />
        ))}
        <polyline
          fill="none"
          strokeWidth="2"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          points={polyline(merged, width, height, pad)}
        />
        <polyline
          fill="none"
          strokeWidth="2"
          className="stroke-sky-600 dark:stroke-sky-400"
          points={polyline(reviewed, width, height, pad)}
        />
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-400">
        <span>{points[0]?.date}</span>
        <span className="inline-flex items-center gap-3">
          <span>Bars: created</span>
          <span className="text-emerald-700 dark:text-emerald-400">
            Line: merged
          </span>
          <span className="text-sky-700 dark:text-sky-400">Line: reviewed</span>
        </span>
        <span>{points[points.length - 1]?.date}</span>
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
      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-sm font-semibold">Score vs previous period</h2>
        <p className="mt-1 mb-4 text-xs text-neutral-500">
          Dark bar is current window. Gray bar is the previous window of the
          same length.
        </p>
        <GroupedScoreChart current={current} previous={previous} />
      </section>
      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-sm font-semibold">Daily activity</h2>
        <p className="mt-1 mb-4 text-xs text-neutral-500">
          PRs created each day, with merged and reviewed overlays.
        </p>
        <ActivityChart points={daily} />
      </section>
    </div>
  );
}
