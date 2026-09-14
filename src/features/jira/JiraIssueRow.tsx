import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

import type { JiraIssue } from "./types";

const STATUS_TONE: Record<string, string> = {
  new: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
  indeterminate: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  unknown:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400",
};

export function JiraIssueRow({ issue }: { issue: JiraIssue }) {
  return (
    <li className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
      <Link
        to={`/jira/${issue.key}`}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
      >
        {issue.type.iconUrl ? (
          <img src={issue.type.iconUrl} alt="" className="mt-0.5 h-4 w-4" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs text-neutral-400">
              {issue.key}
            </span>
            <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {issue.summary}
            </span>
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-xs font-medium",
                STATUS_TONE[issue.status.category] ?? STATUS_TONE.unknown,
              )}
            >
              {issue.status.name}
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            {issue.assignee ? (
              <span className="inline-flex items-center gap-1">
                {issue.assignee.avatarUrl ? (
                  <img
                    src={issue.assignee.avatarUrl}
                    alt=""
                    className="h-3.5 w-3.5 rounded-full"
                  />
                ) : null}
                {issue.assignee.displayName}
              </span>
            ) : (
              <span>Unassigned</span>
            )}
            {issue.storyPoints != null ? (
              <span className="tabular-nums">{issue.storyPoints} SP</span>
            ) : null}
            <span>
              {issue.type.subtask
                ? issue.parent
                  ? `Sub-task of ${issue.parent.key}`
                  : "Sub-task"
                : issue.parent
                  ? `Parent ${issue.parent.key}`
                  : issue.type.name}
            </span>
            {issue.devStart || issue.devEnd ? (
              <span>
                Dev {issue.devStart ?? "—"} → {issue.devEnd ?? "—"}
              </span>
            ) : null}
            {issue.updatedAt ? (
              <span>{relativeTime(issue.updatedAt)}</span>
            ) : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
