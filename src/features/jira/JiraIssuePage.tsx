import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJiraPublic } from "@/lib/use-settings";

import {
  fetchJiraIssueDetail,
  fetchJiraTransitions,
  jiraErrorMessage,
  transitionJiraIssue,
} from "./api";
import type { JiraIssueDetail, JiraTransition } from "./types";

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
        <p className="text-sm text-neutral-500">
          No Jira account connected.{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Connect in Settings
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/jira"
        title={detail?.key ?? issueKey}
        subtitle={detail?.summary}
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
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading issue…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : detail ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-900">
              {detail.status.name}
            </span>
            <span className="text-xs text-neutral-500">{detail.type.name}</span>
            {detail.type.subtask ? (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Sub-task
              </span>
            ) : null}
            {detail.priority ? (
              <span className="text-xs text-neutral-500">
                {detail.priority}
              </span>
            ) : null}
            {detail.assignee ? (
              <span className="text-xs text-neutral-500">
                {detail.assignee.displayName}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48">
              <p className="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                Update status
              </p>
              <Select
                value={transitionId || undefined}
                onValueChange={setTransitionId}
                disabled={saving || transitions.length === 0}
              >
                <SelectTrigger className="w-56" aria-label="New status">
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
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Update status
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DateCard
              label={detail.devStartField?.name ?? "Dev Start"}
              value={detail.devStartField?.text || "—"}
            />
            <DateCard
              label={detail.devEndField?.name ?? "Dev End"}
              value={detail.devEndField?.text || "—"}
            />
          </div>

          <section>
            <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Parent
            </h2>
            <p className="mt-1 text-sm">
              {detail.parent ? (
                <Link
                  to={`/jira/${detail.parent.key}`}
                  className="underline underline-offset-2"
                >
                  {detail.parent.key} — {detail.parent.summary} (
                  {detail.parent.typeName})
                </Link>
              ) : (
                "No parent"
              )}
            </p>
          </section>

          {detail.subtaskKeys.length > 0 ? (
            <section>
              <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                Sub-tasks
              </h2>
              <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                {detail.subtaskKeys.map((key) => (
                  <li key={key}>
                    <Link
                      to={`/jira/${key}`}
                      className="font-mono text-xs underline underline-offset-2"
                    >
                      {key}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {detail.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {detail.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs dark:border-neutral-800"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <section>
            <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Description
            </h2>
            {detail.descriptionText ? (
              <pre className="mt-2 font-sans text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {detail.descriptionText}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">No description.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              All Jira fields ({detail.properties.length})
            </h2>
            <dl className="mt-2 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {detail.properties.map((prop) => (
                <div
                  key={prop.id}
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[14rem_minmax(0,1fr)]"
                >
                  <dt className="text-xs font-medium text-neutral-500">
                    {prop.name}
                  </dt>
                  <dd className="font-mono text-xs break-all whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                    {prop.text}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-3 dark:border-neutral-800">
      <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}
