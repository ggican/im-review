import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Loader2 } from "lucide-react";
import { type ReactNode,useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
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
import { relativeTime } from "@/lib/time";
import { useJiraPublic } from "@/lib/use-settings";

import {
  fetchJiraIssueDetail,
  fetchJiraTransitions,
  jiraErrorMessage,
  transitionJiraIssue,
} from "./api";
import type { JiraIssueDetail, JiraStatusCategory, JiraTransition } from "./types";

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

export function JiraIssuePage() {
  const { issueKey = "" } = useParams();
  const connected = useJiraPublic();
  const [detail, setDetail] = useState<JiraIssueDetail | null>(null);
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [transitionId, setTransitionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected || !issueKey) return;
    setLoading(true);
    setError(null);
    try {
      const [next, nextTransitions] = await Promise.all([
        fetchJiraIssueDetail(issueKey),
        fetchJiraTransitions(issueKey).catch(() => [] as JiraTransition[]),
      ]);
      setDetail(next);
      setTransitions(nextTransitions);
      setTransitionId("");
    } catch (err) {
      setError(jiraErrorMessage(err));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [connected, issueKey]);

  useEffect(() => {
    document.title = issueKey
      ? `${issueKey} · Jira · IM Review`
      : "Jira · IM Review";
  }, [issueKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openInJira() {
    if (!detail) return;
    try {
      await openUrl(detail.browseUrl);
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function updateStatus() {
    if (!issueKey || !transitionId) return;
    setSaving(true);
    try {
      await transitionJiraIssue(issueKey, transitionId);
      toast.success("Status updated");
      await load();
    } catch (err) {
      toast.error(jiraErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!connected) {
    return (
      <PageShell>
        <PageHeader backTo="/jira" title="Jira" subtitle="Connect first" />
        <Card padding="default" variant="streamJira">
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md">No connected account</CardTitle>
            <CardDescription className="text-stream-jira-fg/80">
              Connect Jira in Settings to open issue detail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="accent">
              <Link to="/settings">Connect in Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/jira"
        title={detail?.key ?? issueKey}
        subtitle={detail?.summary}
        leading={
          <Badge variant="jira" className="mt-1">
            Jira
          </Badge>
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void openInJira()}
            disabled={!detail}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Jira
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock>Loading issue…</LoadingBlock>
      ) : error ? (
        <ErrorBlock tone="warning">{error}</ErrorBlock>
      ) : detail ? (
        <div className="space-y-4">
          <Card padding="default" className="border-stream-jira-border/70">
            <CardHeader className="mb-3">
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-stream-jira-fg">
                  {detail.key}
                </span>
                <Badge variant={statusBadgeVariant(detail.status.category)}>
                  {detail.status.name}
                </Badge>
                <Badge variant="outline">{detail.type.name}</Badge>
                {detail.type.subtask ? (
                  <Badge variant="warning">Sub-task</Badge>
                ) : null}
                {detail.priority ? (
                  <Badge variant="secondary">{detail.priority}</Badge>
                ) : null}
                {detail.updatedAt ? (
                  <span>Updated {relativeTime(detail.updatedAt)}</span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetaTile label="Assignee">
                  {detail.assignee ? (
                    <span className="inline-flex items-center gap-1.5">
                      {detail.assignee.avatarUrl ? (
                        <img
                          src={detail.assignee.avatarUrl}
                          alt=""
                          className="h-5 w-5 rounded-full border border-border"
                        />
                      ) : null}
                      {detail.assignee.displayName}
                    </span>
                  ) : (
                    "Unassigned"
                  )}
                </MetaTile>
                <MetaTile label="Story points">
                  {detail.storyPoints != null ? (
                    <span className="font-keycap tabular-nums">
                      {detail.storyPoints} SP
                    </span>
                  ) : (
                    "—"
                  )}
                </MetaTile>
                <MetaTile label={detail.devStartField?.name ?? "Dev Start"}>
                  <span className="font-mono text-sm">
                    {detail.devStartField?.text || "—"}
                  </span>
                </MetaTile>
                <MetaTile label={detail.devEndField?.name ?? "Dev End"}>
                  <span className="font-mono text-sm">
                    {detail.devEndField?.text || "—"}
                  </span>
                </MetaTile>
              </div>

              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-container-low/40 p-3">
                <div className="min-w-48 flex-1">
                  <p className="mb-1 text-label-sm tracking-wide text-on-surface-variant uppercase">
                    Update status
                  </p>
                  <Select
                    value={transitionId || undefined}
                    onValueChange={setTransitionId}
                    disabled={saving || transitions.length === 0}
                  >
                    <SelectTrigger className="w-full max-w-xs" aria-label="New status">
                      <SelectValue
                        placeholder={
                          transitions.length === 0
                            ? "No transitions"
                            : "Choose status…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {transitions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                          {item.toName !== item.name ? ` → ${item.toName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!transitionId || saving}
                  onClick={() => void updateStatus()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Update status
                </Button>
              </div>

              {detail.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detail.labels.map((label) => (
                    <Badge key={label} variant="jira">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="default">
              <CardHeader className="mb-2">
                <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                  Parent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body-md text-on-surface">
                  {detail.parent ? (
                    <Link
                      to={`/jira/${detail.parent.key}`}
                      className="underline underline-offset-2"
                    >
                      <span className="font-mono text-xs text-stream-jira-fg">
                        {detail.parent.key}
                      </span>{" "}
                      — {detail.parent.summary} ({detail.parent.typeName})
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant">No parent</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card padding="default">
              <CardHeader className="mb-2">
                <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                  Sub-tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detail.subtaskKeys.length > 0 ? (
                  <ul className="flex flex-wrap gap-2 text-body-sm">
                    {detail.subtaskKeys.map((key) => (
                      <li key={key}>
                        <Link
                          to={`/jira/${key}`}
                          className="font-mono text-xs text-stream-jira-fg underline underline-offset-2"
                        >
                          {key}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-md text-on-surface-variant">
                    No sub-tasks
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detail.descriptionText ? (
                <pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-surface-container-low p-3 font-sans text-body-md leading-relaxed whitespace-pre-wrap text-on-surface">
                  {detail.descriptionText}
                </pre>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-body-md text-on-surface-variant">
                  No description.
                </p>
              )}
            </CardContent>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-headline text-title-md font-semibold text-on-surface">
                All Jira fields ({detail.properties.length})
              </h2>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Live field values from Jira — nothing invented.
              </p>
            </div>
            <dl className="divide-y divide-border">
              {detail.properties.map((prop) => (
                <div
                  key={prop.id}
                  className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_minmax(0,1fr)]"
                >
                  <dt className="text-label-sm font-medium text-on-surface-variant">
                    {prop.name}
                  </dt>
                  <dd className="font-mono text-xs break-all whitespace-pre-wrap text-on-surface">
                    {prop.text}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      ) : (
        <p className="py-10 text-center text-body-md text-on-surface-variant">
          No issue found.
        </p>
      )}
    </PageShell>
  );
}

function MetaTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-container-low/40 px-3 py-2.5">
      <p className="text-label-sm tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      <div className="mt-1 text-body-md text-on-surface">{children}</div>
    </div>
  );
}
