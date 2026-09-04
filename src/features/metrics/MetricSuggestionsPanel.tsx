import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ExternalLink,
  GitMerge,
  GitPullRequestArrow,
  Lightbulb,
  Scissors,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import type { MetricSuggestion } from "./types";

function actionIcon(action: MetricSuggestion["action"]) {
  switch (action) {
    case "review":
      return <GitPullRequestArrow className="h-4 w-4 shrink-0" />;
    case "merge":
      return <GitMerge className="h-4 w-4 shrink-0" />;
    case "fix_ci":
      return <Wrench className="h-4 w-4 shrink-0" />;
    case "split":
      return <Scissors className="h-4 w-4 shrink-0" />;
    default:
      return <Lightbulb className="h-4 w-4 shrink-0" />;
  }
}

function priorityClass(priority: MetricSuggestion["priority"]): string {
  switch (priority) {
    case "high":
      return "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20";
    case "medium":
      return "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950";
    default:
      return "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900";
  }
}

async function openPr(url: string) {
  try {
    await openUrl(url);
  } catch (err) {
    toast.error(String(err));
  }
}

function reviewPath(repo: string, number: number): string {
  const [owner, name] = repo.split("/");
  return `/review/${owner}/${name}/${number}`;
}

export function MetricSuggestionsPanel({
  suggestions,
}: {
  suggestions: MetricSuggestion[];
}) {
  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="h-4 w-4" />
          Suggestions to raise your score
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Concrete next actions from your open PRs and review queue. Estimates
          are directional — refresh Metrics after you act.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          No urgent actions right now. Keep shipping small reviewed PRs.
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border px-3 py-3",
                priorityClass(item.priority),
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="mt-0.5 text-neutral-600 dark:text-neutral-300">
                  {actionIcon(item.action)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                      {item.title}
                    </span>
                    <span className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs tracking-wide text-neutral-500 uppercase dark:border-neutral-700">
                      {item.category}
                    </span>
                    <span className="text-xs tracking-wide text-neutral-400 uppercase">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.reason}
                  </p>
                  <p className="mt-1 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {item.impact}
                  </p>
                  {item.pr ? (
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {item.pr.title}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.pr && item.action === "review" ? (
                    <Button asChild size="sm" variant="default">
                      <Link to={reviewPath(item.pr.repo, item.pr.number)}>
                        Review in app
                      </Link>
                    </Button>
                  ) : null}
                  {item.pr ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void openPr(item.pr!.url)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {item.actionLabel}
                    </Button>
                  ) : item.action === "review" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/">{item.actionLabel}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
