# Metrics formulas (IM Review)

This document is the **source of truth** for how the scorecard is calculated so contributors can improve or replace heuristics with stronger, industry-aligned formulas.

Implementation: `src/features/metrics/score.ts`, `src/features/metrics/stats.ts`, `src/features/metrics/suggestions.ts`.

---

## Scope (V1)

- Subject: signed-in engineer (`@me`)
- Window: Today / 7 / 14 / 30 days (default **7**)
- Data: GitHub Search + PR detail / reviews / commits / CI statuses
- CI Health is **informational** and **not** included in Overall

---

## Overall score

```text
Overall = 0.25 × Speed
        + 0.40 × Throughput
        + 0.15 × Quality
        + 0.20 × Collaboration
```

Each category score is `0…100` (rounded). Overall is the weighted sum, then clamped/rounded to `0…100`.

**Trend:** compare current window score vs the previous window of the **same length**  
(e.g. last 7 days vs the 7 days before that).

```text
Δ% = (current − previous) / previous × 100
```

---

## Aggregation selector

For distribution metrics (times, sizes, comment counts), the UI aggregation mode picks one statistic:

| Mode                                        | Meaning                         |
| ------------------------------------------- | ------------------------------- |
| Average                                     | arithmetic mean                 |
| 50th / 75th / 90th / 95th / 99th Percentile | linear interpolation percentile |

Rate metrics (merge rate, PR creation rate, coding days, etc.) stay **window totals / rates** and do not switch with percentile.

Helpers: `aggregate()` in `src/features/metrics/stats.ts`.

---

## Category → raw metrics

Each category score = **average of its metric scores** (equal weight inside the category).

### Speed (weight 25%)

| Metric key          | Raw input                                         | Direction    | Notes                                |
| ------------------- | ------------------------------------------------- | ------------ | ------------------------------------ |
| `cycleTime`         | hours from `created_at` → `merged_at`             | lower better | Only merged PRs                      |
| `cycleTimeVariance` | coefficient of variation of cycle times           | lower better | Needs ≥2 merged PRs; else neutral 50 |
| `codingTime`        | hours from `created_at` → first non-author review | lower better | Proxy; not git first-commit          |

**V1 bands (`cycleTime` hours):**

| ≤24 | ≤48 | ≤72 | ≤120 | ≤168 | else |
| --- | --- | --- | ---- | ---- | ---- |
| 100 | 85  | 70  | 55   | 40   | 25   |

**V1 bands (`codingTime` hours):**

| ≤12 | ≤24 | ≤48 | ≤72 | else |
| --- | --- | --- | --- | ---- |
| 100 | 85  | 70  | 50  | 30   |

**V1 bands (CV):**

| ≤0.2 | ≤0.4 | ≤0.6 | ≤0.8 | else |
| ---- | ---- | ---- | ---- | ---- |
| 100  | 80   | 60   | 40   | 25   |

### Quality (weight 15%)

| Metric key       | Raw input                               | Direction    |
| ---------------- | --------------------------------------- | ------------ |
| `unreviewedRate` | merged PRs with zero non-author reviews | lower better |
| `prSize`         | additions + deletions (aggregated)      | lower better |
| `postPrCommits`  | commit count on PR                      | lower better |

### Throughput (weight 40%)

| Metric key       | Raw input                                | Direction                    |
| ---------------- | ---------------------------------------- | ---------------------------- |
| `prCreationRate` | authored PRs / week                      | higher better                |
| `mergeRate`      | merged / authored in window              | higher better                |
| `codingDays`     | distinct days with create/merge activity | higher better                |
| `locChanges`     | (add+del) / week                         | sweet spot 200–2000 LOC/week |

### Collaboration (weight 20%)

| Metric key          | Raw input                                        | Direction     |
| ------------------- | ------------------------------------------------ | ------------- |
| `timeToFirstReview` | hours to first non-author review on authored PRs | lower better  |
| `prsReviewed`       | count of PRs `reviewed-by:@me` in window         | higher better |
| `commentsPerPr`     | comments on authored PRs (aggregated)            | higher better |

Exact numeric bands live in `score.ts` (`scoreLowerIsBetter` / `scoreHigherIsBetter` / `scoreRangeIsBest`). Prefer changing bands there **and** updating this table in the same PR.

---

## Empty / missing data

- Missing distribution sample → often score **50** (neutral) so one PR does not fake “elite”
- Zero activity rates → lower empty scores (see `emptyScore` args in `score.ts`)

---

## CI Health (not in Overall)

Aggregated from commit statuses + check runs on authored PRs:

- passing / pending / failing counts
- pass rate
- top failing contexts
- latest failing PRs

---

## Known gaps vs tools like Signals AI

| Topic               | IM Review V1                | Typical Signals-style         |
| ------------------- | ------------------------- | ----------------------------- |
| Normalization       | Fixed heuristic bands     | Org / P75 benchmarks          |
| Coding time         | PR created → first review | Often first commit → PR/merge |
| AI line attribution | Not measured              | Commit-level AI %             |
| Data source         | GitHub API only           | Git + GitHub                  |

Improving toward P75 org benchmarks or git-based coding time is a welcome contribution — propose the formula here first.

---

## How to propose a better formula

1. Open an issue: **Metrics formula: \<name\>**
2. Specify:
   - raw inputs (exact GitHub fields or new fetches)
   - aggregation (mean / median / P75)
   - mapping to `0…100`
   - category weight impact
   - empty-data behavior
3. Add a small fixture table (example PR set → expected scores)
4. Implement in `score.ts` + update this doc + keep UI raw values auditable

### Design principles

1. **Auditable** — always show raw next to score
2. **Deterministic** — same inputs → same score
3. **Stable empty states** — don’t oscillate wildly on 0–1 PR
4. **No silent CI in Overall** until explicitly weighted
5. **Human coaching first** — scores suggest actions; they are not performance reviews

---

## Suggestions engine

`buildMetricSuggestions()` maps low category scores + open PRs / review queue into actions:

- Review pending review-requested PRs → Collaboration
- Merge / fix CI on aging authored PRs → Speed / Throughput
- Split large PRs / request review → Quality

Suggestions are coaching heuristics, not guaranteed point gains.
