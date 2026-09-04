import type { PullRequest } from "@/features/pr/types";

import type {
  EngineerMetricsRaw,
  EnrichedAuthoredPr,
  MetricCategory,
  MetricsScorecard,
  MetricSuggestion,
} from "./types";

function ageHours(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (now - t) / 3_600_000);
}

function prRef(pr: PullRequest) {
  return {
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
  };
}

function categoryScore(
  scorecard: MetricsScorecard,
  category: MetricCategory,
): number {
  return scorecard[category].score;
}

function openAuthored(raw: EngineerMetricsRaw): EnrichedAuthoredPr[] {
  return raw.authored.filter((p) => !p.mergedAt && p.pr.state !== "closed");
}

function sortByAgeDesc(items: EnrichedAuthoredPr[]): EnrichedAuthoredPr[] {
  return [...items].sort(
    (a, b) =>
      new Date(a.pr.createdAt).getTime() - new Date(b.pr.createdAt).getTime(),
  );
}

function reviewsNeededForBand(currentCount: number, target = 8): number {
  return Math.max(0, target - currentCount);
}

/**
 * Concrete coaching actions from the current scorecard + open PRs.
 * Heuristic only — not a guarantee the score will move by X points.
 */
export function buildMetricSuggestions(input: {
  scorecard: MetricsScorecard;
  raw: EngineerMetricsRaw;
  reviewRequested: PullRequest[];
  myOpenPrs: PullRequest[];
}): MetricSuggestion[] {
  const { scorecard, raw, reviewRequested, myOpenPrs } = input;
  const suggestions: MetricSuggestion[] = [];
  const open = openAuthored(raw);
  const openByKey = new Map(
    open.map((p) => [`${p.pr.repo}#${p.pr.number}`, p]),
  );

  // Prefer live open PRs for merge/follow-up if enrichment missed older ones.
  for (const pr of myOpenPrs) {
    const key = `${pr.repo}#${pr.number}`;
    if (!openByKey.has(key)) {
      openByKey.set(key, {
        pr,
        mergedAt: null,
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        headSha: "",
        commitCount: 0,
        reviewCount: 0,
        commentCount: 0,
        hadReviewBeforeMerge: false,
        hoursToFirstReview: null,
        hoursCycleTime: ageHours(pr.createdAt),
        ciSnapshot: null,
      });
    }
  }
  const openList = [...openByKey.values()];

  const collabScore = categoryScore(scorecard, "collaboration");
  const speedScore = categoryScore(scorecard, "speed");
  const throughputScore = categoryScore(scorecard, "throughput");
  const qualityScore = categoryScore(scorecard, "quality");

  // --- Collaboration: review pending requests ---
  if (collabScore < 75 && reviewRequested.length > 0) {
    const need = reviewsNeededForBand(raw.reviewed.length, 8);
    const pick = reviewRequested.slice(0, Math.max(3, Math.min(5, need || 3)));
    for (const [i, pr] of pick.entries()) {
      suggestions.push({
        id: `review-${pr.repo}-${pr.number}`,
        category: "collaboration",
        priority: i === 0 ? "high" : "medium",
        title: `Review ${pr.repo} #${pr.number}`,
        reason: `You have ${reviewRequested.length} open review request${reviewRequested.length === 1 ? "" : "s"}. Submitting reviews lifts PRs reviewed and time-to-first-review for the author.`,
        impact:
          need > 0
            ? `Do ~${need} more review${need === 1 ? "" : "s"} this window to push Collaboration toward the next band.`
            : "Extra reviews still strengthen Collaboration and Overall (20% weight).",
        action: "review",
        actionLabel: "Open to review",
        pr: prRef(pr),
      });
    }
  } else if (collabScore < 60 && reviewRequested.length === 0) {
    suggestions.push({
      id: "collab-find-reviews",
      category: "collaboration",
      priority: "medium",
      title: "Pick up reviews from teammates",
      reason:
        "Collaboration is low and you have no pending review requests. Looking for open PRs on favorite repos still counts toward PRs reviewed.",
      impact:
        "Aim for 4–8 reviews in this window to move Collaboration above 55–70.",
      action: "review",
      actionLabel: "Go to Review tab",
    });
  }

  // --- Speed / Throughput: merge aging open PRs ---
  const aging = sortByAgeDesc(openList).filter(
    (p) => ageHours(p.pr.createdAt) >= 24,
  );
  if ((speedScore < 80 || throughputScore < 70) && aging.length > 0) {
    for (const item of aging.slice(0, 3)) {
      const hours = ageHours(item.pr.createdAt);
      const reviewed = item.hadReviewBeforeMerge || item.reviewCount > 0;
      const ciFail =
        item.ciSnapshot?.overall === "failure" ||
        (item.ciSnapshot?.failedCount ?? 0) > 0;

      if (ciFail) {
        suggestions.push({
          id: `ci-${item.pr.repo}-${item.pr.number}`,
          category: "speed",
          priority: "high",
          title: `Fix CI on ${item.pr.repo} #${item.pr.number}`,
          reason: `This PR is ~${hours.toFixed(0)}h old and CI is failing — it is blocking merge and dragging cycle time / merge rate.`,
          impact:
            "Unblocking merge improves Speed and Throughput once it lands.",
          action: "fix_ci",
          actionLabel: "Open failing PR",
          pr: prRef(item.pr),
        });
        continue;
      }

      suggestions.push({
        id: `merge-${item.pr.repo}-${item.pr.number}`,
        category: speedScore <= throughputScore ? "speed" : "throughput",
        priority: hours >= 72 ? "high" : "medium",
        title: reviewed
          ? `Merge ${item.pr.repo} #${item.pr.number}`
          : `Get review then merge ${item.pr.repo} #${item.pr.number}`,
        reason: reviewed
          ? `Open ~${hours.toFixed(0)}h — merging closes cycle time and raises merge rate.`
          : `Open ~${hours.toFixed(0)}h without much review coverage. Ping reviewers or self-check, then merge when ready.`,
        impact: reviewed
          ? "Merging this PR should lift Speed (cycle time) and Throughput (merge rate)."
          : "Landing it after a review also helps Quality (unreviewed rate).",
        action: reviewed ? "merge" : "follow_up",
        actionLabel: reviewed ? "Open to merge" : "Open PR",
        pr: prRef(item.pr),
      });
    }
  }

  // --- Quality: large PRs ---
  if (qualityScore < 80) {
    const large = openList
      .filter((p) => p.additions + p.deletions >= 400)
      .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
    for (const item of large.slice(0, 2)) {
      const loc = item.additions + item.deletions;
      suggestions.push({
        id: `split-${item.pr.repo}-${item.pr.number}`,
        category: "quality",
        priority: loc >= 1000 ? "high" : "medium",
        title: `Split ${item.pr.repo} #${item.pr.number} (${loc} LOC)`,
        reason:
          "Large PRs score worse on PR size and usually take longer to review/merge.",
        impact:
          "Smaller PRs improve Quality and often Speed on the next window.",
        action: "split",
        actionLabel: "Open PR",
        pr: prRef(item.pr),
      });
    }

    const unreviewedOpen = openList.filter(
      (p) => p.reviewCount === 0 && !p.hadReviewBeforeMerge,
    );
    for (const item of unreviewedOpen.slice(0, 2)) {
      if (
        suggestions.some(
          (s) => s.pr?.number === item.pr.number && s.pr.repo === item.pr.repo,
        )
      ) {
        continue;
      }
      suggestions.push({
        id: `need-review-${item.pr.repo}-${item.pr.number}`,
        category: "quality",
        priority: "medium",
        title: `Request review on ${item.pr.repo} #${item.pr.number}`,
        reason:
          "Merging without a review hurts Unreviewed PR rate. Ask a teammate before merge.",
        impact:
          "Raises Quality and shortens time-to-first-review once someone picks it up.",
        action: "follow_up",
        actionLabel: "Open PR",
        pr: prRef(item.pr),
      });
    }
  }

  // --- Throughput: low creation ---
  if (
    throughputScore < 55 &&
    openList.length === 0 &&
    raw.authored.length < 2
  ) {
    suggestions.push({
      id: "throughput-ship",
      category: "throughput",
      priority: "medium",
      title: "Ship a small PR this window",
      reason:
        "Throughput is low because PR creation / merge volume is thin in this window.",
      impact:
        "Even 1–2 small merged PRs moves creation rate, coding days, and Overall (40% Throughput).",
      action: "follow_up",
      actionLabel: "Open GitHub",
    });
  }

  // Deduplicate by id, prioritize high, cap list
  const rank = { high: 0, medium: 1, low: 2 };
  const seen = new Set<string>();
  return suggestions
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .sort((a, b) => rank[a.priority] - rank[b.priority])
    .slice(0, 8);
}
