import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink } from "lucide-react";
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { relativeTime } from "@/lib/time";

import type { JiraIssue, JiraStatusCategory } from "./types";

function statusBadgeVariant(
  category: JiraStatusCategory,
): "success" | "jira" | "outline" | "secondary" {
  switch (category) {
    case "done":
      return "success";
    case "indeterminate":
      return "jira";
    case "new":
      return "outline";
    default:
      return "secondary";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function JiraIssueRow({ issue }: { issue: JiraIssue }) {
  async function openInJira(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await openUrl(issue.browseUrl);
    } catch (err) {
      toast.error(String(err));
    }
  }

  return (
    <li className="border-border border-b last:border-b-0">
      <div className="hover:bg-surface-container-low/60 flex items-start gap-2 px-3 py-2.5">
        <Link
          to={`/jira/${issue.key}`}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`Open ${issue.key} detail`}
        >
          {issue.type.iconUrl ? (
            <img
              src={issue.type.iconUrl}
              alt=""
              className="mt-0.5 h-4 w-4 shrink-0"
            />
          ) : (
            <Badge variant="jira" className="mt-0.5 px-1.5 py-0 text-[10px]">
              Jira
            </Badge>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-stream-jira-fg font-mono text-xs">
                {issue.key}
              </span>
              <span className="text-body-md text-on-surface truncate font-medium">
                {issue.summary}
              </span>
              <Badge variant={statusBadgeVariant(issue.status.category)}>
                {issue.status.name}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {issue.type.name}
              </Badge>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {issue.assignee ? (
                <span className="inline-flex items-center gap-1.5">
                  {issue.assignee.avatarUrl ? (
                    <img
                      src={issue.assignee.avatarUrl}
                      alt=""
                      className="border-border h-4 w-4 rounded-full border"
                    />
                  ) : (
                    <span
                      className="bg-stream-jira font-keycap text-stream-jira-fg flex h-4 w-4 items-center justify-center rounded-full"
                      aria-hidden
                    >
                      {initials(issue.assignee.displayName)}
                    </span>
                  )}
                  {issue.assignee.displayName}
                </span>
              ) : (
                <span>Unassigned</span>
              )}
              {issue.storyPoints != null ? (
                <span className="font-keycap tabular-nums">
                  {issue.storyPoints} SP
                </span>
              ) : null}
              <span>
                {issue.type.subtask
                  ? issue.parent
                    ? `Sub-task of ${issue.parent.key}`
                    : "Sub-task"
                  : issue.parent
                    ? `Parent ${issue.parent.key}`
                    : null}
              </span>
              {issue.devStart || issue.devEnd ? (
                <span className="font-mono text-xs">
                  Dev {issue.devStart ?? "—"} → {issue.devEnd ?? "—"}
                </span>
              ) : null}
              {issue.updatedAt ? (
                <span>{relativeTime(issue.updatedAt)}</span>
              ) : null}
            </p>
          </div>
        </Link>
        <IconButton
          type="button"
          size="icon-sm"
          variant="outline"
          className="mt-0.5 shrink-0"
          aria-label={`Open ${issue.key} in Jira`}
          onClick={(e) => void openInJira(e)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </li>
  );
}
