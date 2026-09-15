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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function priorityVariant(
  priority: MetricSuggestion["priority"],
): "warning" | "secondary" | "outline" {
  switch (priority) {
    case "high":
      return "warning";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function priorityShell(priority: MetricSuggestion["priority"]): string {
  switch (priority) {
    case "high":
      return "border-warning/40 bg-warning-container/40";
    case "medium":
      return "border-border bg-surface-container-lowest";
    default:
      return "border-border bg-surface-container-low/50";
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
    <Card padding="default">
      <CardHeader className="mb-3">
        <CardTitle className="flex items-center gap-2 text-title-md">
          <Lightbulb className="h-4 w-4 text-warning" aria-hidden />
          Suggestions to raise your score
        </CardTitle>
        <CardDescription>
          Concrete next actions from your open PRs and review queue. Estimates
          are directional — refresh Metrics after you act.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-10 text-center text-body-md text-on-surface-variant">
            No urgent actions right now. Keep shipping small reviewed PRs.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border px-3 py-3",
                  priorityShell(item.priority),
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="mt-0.5 text-on-surface-variant">
                    {actionIcon(item.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-md font-medium text-on-surface">
                        {item.title}
                      </span>
                      <Badge variant="outline" className="uppercase">
                        {item.category}
                      </Badge>
                      <Badge
                        variant={priorityVariant(item.priority)}
                        className="uppercase"
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                      {item.reason}
                    </p>
                    <p className="mt-1 text-body-sm font-medium text-on-surface">
                      {item.impact}
                    </p>
                    {item.pr ? (
                      <p className="mt-1 truncate text-body-sm text-on-surface-variant">
                        {item.pr.title}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.pr && item.action === "review" ? (
                      <Button asChild size="sm" variant="accent">
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
      </CardContent>
    </Card>
  );
}
