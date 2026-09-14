import {
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  deleteJiraSavedFilter,
  newJiraFilterId,
  upsertJiraSavedFilter,
} from "@/lib/settings";
import { useJiraPublic, useJiraSavedFilters } from "@/lib/use-settings";

import {
  fetchJiraIssueTypes,
  fetchRemoteJiraFilters,
  groupIssuesByStatus,
  jiraErrorMessage,
  saveFilterToJira,
  searchJiraIssues,
  suggestJiraLabels,
} from "./api";
import { JiraIssueRow } from "./JiraIssueRow";
import { compileJql, extraJqlHasAssignee, sanitizeJql } from "./jql";
import type {
  JiraIssue,
  JiraIssueType,
  JiraRemoteFilter,
  JiraSavedFilter,
} from "./types";

const MY_WORK_ID = "my-work";

export function JiraPage() {
  const connected = useJiraPublic();
  const saved = useJiraSavedFilters();
  const [types, setTypes] = useState<JiraIssueType[]>([]);
  const [typeId, setTypeId] = useState("all");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelHints, setLabelHints] = useState<string[]>([]);
  const [extraJql, setExtraJql] = useState("");
  const [includeDone, setIncludeDone] = useState(false);
  const [rawJql, setRawJql] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(MY_WORK_ID);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jqlError, setJqlError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [remote, setRemote] = useState<JiraRemoteFilter[]>([]);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [statusTab, setStatusTab] = useState("all");

  const selectedType = types.find((t) => t.name === typeId) ?? null;
  const typeNames = typeId !== "all" ? [typeId] : [];
  const compiled = compileJql({
    typeNames,
    labels,
    extraJql,
    includeDone,
  });
  const jql = sanitizeJql(rawJql ?? compiled);
  const assigneeWarn = extraJqlHasAssignee(extraJql);

  const grouped = useMemo(() => groupIssuesByStatus(issues), [issues]);
  const visibleGrouped = useMemo(
    () =>
      statusTab === "all"
        ? grouped
        : grouped.filter((group) => group.status === statusTab),
    [grouped, statusTab],
  );

  useEffect(() => {
    if (statusTab === "all") return;
    if (!grouped.some((group) => group.status === statusTab)) {
      setStatusTab("all");
    }
  }, [grouped, statusTab]);

  useEffect(() => {
    document.title = "Jira · IM Review";
  }, []);

  useEffect(() => {
    if (!connected) return;
    void fetchJiraIssueTypes()
      .then(setTypes)
      .catch((err) => toast.error(jiraErrorMessage(err)));
    void fetchRemoteJiraFilters()
      .then(setRemote)
      .catch(() => setRemote([]));
  }, [connected]);

  useEffect(() => {
    const q = labelDraft.trim();
    if (!connected) return;
    const t = window.setTimeout(() => {
      void suggestJiraLabels(q)
        .then(setLabelHints)
        .catch(() => setLabelHints([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [labelDraft, connected]);

  const load = useCallback(
    async (reset: boolean, token?: string | null) => {
      if (!connected) return;
      setLoading(true);
      if (reset) setJqlError(null);
      try {
        const page = await searchJiraIssues(jql, token ?? null);
        setIssues((prev) => (reset ? page.issues : [...prev, ...page.issues]));
        setNextToken(page.isLast ? null : page.nextPageToken);
      } catch (err) {
        const message = jiraErrorMessage(err);
        setJqlError(message);
        if (reset) setIssues([]);
      } finally {
        setLoading(false);
      }
    },
    [connected, jql],
  );

  useEffect(() => {
    if (!connected) return;
    const t = window.setTimeout(() => {
      void load(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, [connected, load]);

  function resetToMyWork() {
    setRawJql(null);
    setTypeId("all");
    setLabels([]);
    setLabelDraft("");
    setExtraJql("");
    setIncludeDone(false);
    setActiveId(MY_WORK_ID);
  }

  function applyLocal(filter: JiraSavedFilter) {
    setRawJql(null);
    const fromName = filter.typeNames[0];
    const fromId = types.find((t) => t.id === filter.typeIds[0])?.name;
    setTypeId(fromName || fromId || "all");
    setLabels(filter.labels);
    setExtraJql(filter.extraJql);
    setIncludeDone(filter.includeDone);
    setActiveId(filter.id);
  }

  function applyRemote(filter: JiraRemoteFilter) {
    setRawJql(filter.jql);
    setTypeId("all");
    setLabels([]);
    setExtraJql("");
    setIncludeDone(true);
    setActiveId(`remote-${filter.id}`);
  }

  function onControlChange() {
    setRawJql(null);
    setActiveId(MY_WORK_ID);
  }

  function saveCurrent() {
    const name = saveName.trim();
    if (!name) {
      toast.error("Name the filter first");
      return;
    }
    if (saved.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A local filter already uses that name");
      return;
    }
    const now = new Date().toISOString();
    const id = newJiraFilterId();
    upsertJiraSavedFilter({
      id,
      name,
      jql,
      typeIds: selectedType ? [selectedType.id] : [],
      typeNames,
      labels,
      extraJql,
      includeDone,
      groupBy: "status",
      createdAt: now,
      updatedAt: now,
    });
    setActiveId(id);
    setSaveName("");
    toast.success(`Saved “${name}”`);
  }

  async function pushToJira(filter: JiraSavedFilter) {
    try {
      const id = await saveFilterToJira({
        name: filter.name,
        jql: filter.jql,
        jiraFilterId: filter.jiraFilterId,
      });
      upsertJiraSavedFilter({
        ...filter,
        jiraFilterId: id,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Saved “${filter.name}” to Jira`);
    } catch (err) {
      toast.error(jiraErrorMessage(err));
    }
  }

  const activeLocal = saved.find((f) => f.id === activeId) ?? null;
  const filterValue =
    activeId === MY_WORK_ID ||
    saved.some((f) => f.id === activeId) ||
    remote.some((f) => `remote-${f.id}` === activeId)
      ? activeId
      : MY_WORK_ID;
  const isDefaultView =
    filterValue === MY_WORK_ID &&
    typeId === "all" &&
    labels.length === 0 &&
    extraJql.trim() === "" &&
    !includeDone &&
    rawJql == null;

  if (!connected) {
    return (
      <PageShell>
        <PageHeader
          backTo="/"
          title="Jira"
          subtitle="Connect your Atlassian site"
        />
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
        backTo="/"
        title="Jira"
        subtitle={`${connected.displayName} · ${connected.host.replace(/^https:\/\//, "")}`}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterValue}
            onValueChange={(value) => {
              if (value === MY_WORK_ID) {
                resetToMyWork();
                return;
              }
              const local = saved.find((f) => f.id === value);
              if (local) {
                applyLocal(local);
                return;
              }
              const remoteId = value.startsWith("remote-")
                ? value.slice("remote-".length)
                : "";
              const fromJira = remote.find((f) => f.id === remoteId);
              if (fromJira) applyRemote(fromJira);
            }}
          >
            <SelectTrigger className="w-52" aria-label="Saved filter">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MY_WORK_ID}>My work</SelectItem>
              {saved.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Saved</SelectLabel>
                  {saved.map((filter) => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {remote.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>From Jira</SelectLabel>
                  {remote.map((filter) => (
                    <SelectItem key={filter.id} value={`remote-${filter.id}`}>
                      {filter.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {isDefaultView ? null : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="Clear filter"
              title="Clear filter"
              onClick={resetToMyWork}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Select
            value={typeId}
            onValueChange={(value) => {
              setTypeId(value);
              onControlChange();
            }}
          >
            <SelectTrigger className="w-36" aria-label="Issue type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {types.map((type) => (
                <SelectItem key={type.name} value={type.name}>
                  <span className="flex items-center gap-2">
                    {type.iconUrl ? (
                      <img src={type.iconUrl} alt="" className="h-3.5 w-3.5" />
                    ) : null}
                    {type.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form
            className="w-36"
            onSubmit={(e) => {
              e.preventDefault();
              const next = labelDraft.trim();
              if (!next || labels.includes(next)) return;
              setLabels([...labels, next]);
              setLabelDraft("");
              onControlChange();
            }}
          >
            <Input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Label…"
              aria-label="Filter by label"
              className="h-8 text-xs"
            />
          </form>
          <Button
            type="button"
            size="sm"
            variant={includeDone ? "default" : "outline"}
            onClick={() => {
              setIncludeDone((v) => !v);
              onControlChange();
            }}
          >
            Include done
          </Button>
          <Button
            type="button"
            size="sm"
            variant={configureOpen ? "default" : "outline"}
            aria-expanded={configureOpen}
            aria-label="Configure filter"
            onClick={() => setConfigureOpen((open) => !open)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Configure
          </Button>
        </div>
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs dark:border-neutral-800"
                onClick={() => {
                  setLabels(labels.filter((l) => l !== label));
                  onControlChange();
                }}
              >
                {label} ×
              </button>
            ))}
          </div>
        ) : null}
        {labelDraft && labelHints.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {labelHints.slice(0, 8).map((hint) => (
              <button
                key={hint}
                type="button"
                className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-900"
                onClick={() => {
                  if (!labels.includes(hint)) setLabels([...labels, hint]);
                  setLabelDraft("");
                  onControlChange();
                }}
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null}
        {configureOpen ? (
          <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Filter configuration</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Close configuration"
                onClick={() => setConfigureOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Textarea
              value={extraJql}
              onChange={(e) => {
                setExtraJql(e.target.value);
                onControlChange();
              }}
              placeholder={`assignee IN (currentUser(), accountId) AND labels = ttd-fe-88\nORDER BY created DESC`}
              aria-label="Extra JQL"
              className="min-h-[5.5rem] font-mono text-xs"
            />
            {assigneeWarn ? (
              <p className="text-xs text-neutral-500">
                Your assignee clause is used as written — not limited to
                currentUser() only.
              </p>
            ) : null}
            <p className="font-mono text-xs break-all text-neutral-500">
              {jql}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Save as…"
                aria-label="Save filter as"
                className="h-8 w-44 text-xs"
              />
              <Button type="button" size="sm" onClick={saveCurrent}>
                Save filter
              </Button>
              {activeLocal ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void pushToJira(activeLocal)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Save to Jira
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${activeLocal.name}`}
                    onClick={() => {
                      deleteJiraSavedFilter(activeLocal.id);
                      resetToMyWork();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {jqlError ? (
          <p className="text-xs text-red-600 dark:text-red-400">{jqlError}</p>
        ) : null}

        {issues.length > 0 ? (
          <div className="overflow-x-auto">
            <div
              role="tablist"
              aria-label="Jira workflow"
              className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 whitespace-nowrap dark:border-neutral-800 dark:bg-neutral-900"
            >
              <button
                type="button"
                role="tab"
                aria-selected={statusTab === "all"}
                onClick={() => setStatusTab("all")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  statusTab === "all"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                )}
              >
                All
                <span className="ml-1.5 text-neutral-400 tabular-nums">
                  {issues.length}
                </span>
              </button>
              {grouped.map((group) => {
                const selected = statusTab === group.status;
                return (
                  <button
                    key={group.status}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setStatusTab(group.status)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                    )}
                  >
                    {group.status}
                    <span className="ml-1.5 text-neutral-400 tabular-nums">
                      {group.items.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          {loading && issues.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Jira issues…
            </div>
          ) : visibleGrouped.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-neutral-500">
              No issues match this filter.
            </p>
          ) : (
            visibleGrouped.map((group) => (
              <div key={group.status}>
                {statusTab === "all" ? (
                  <div className="bg-neutral-50 px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:bg-neutral-900/80">
                    {group.status} ({group.items.length})
                  </div>
                ) : null}
                <ul>
                  {group.items.map((issue) => (
                    <JiraIssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        {nextToken ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load(false, nextToken)}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </PageShell>
  );
}
