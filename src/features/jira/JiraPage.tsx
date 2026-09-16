import {
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button, IconButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
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
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  deleteJiraSavedFilter,
  newJiraFilterId,
  saveJiraStatusTabOrder,
  upsertJiraSavedFilter,
} from "@/lib/settings";
import {
  useJiraPublic,
  useJiraSavedFilters,
  useJiraStatusTabOrder,
} from "@/lib/use-settings";

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
import {
  applyStatusTabOrder,
  mergeStatusTabOrder,
  reorderStatusTab,
} from "./status-tab-order";
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
  const [assigneeDraft, setAssigneeDraft] = useState("");
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
  const [draggingStatus, setDraggingStatus] = useState<string | null>(null);
  const dragStatusRef = useRef<string | null>(null);
  const statusTabOrder = useJiraStatusTabOrder();

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
  const assigneeNeedle = assigneeDraft.trim().toLowerCase();
  const filteredGrouped = useMemo(() => {
    const base = !assigneeNeedle
      ? grouped
      : grouped
          .map((group) => ({
            ...group,
            items: group.items.filter((issue) => {
              const name = issue.assignee?.displayName?.toLowerCase() ?? "";
              if (assigneeNeedle === "unassigned") return !issue.assignee;
              return name.includes(assigneeNeedle);
            }),
          }))
          .filter((group) => group.items.length > 0);
    return applyStatusTabOrder(base, statusTabOrder);
  }, [grouped, assigneeNeedle, statusTabOrder]);
  const visibleGrouped = useMemo(
    () =>
      statusTab === "all"
        ? filteredGrouped
        : filteredGrouped.filter((group) => group.status === statusTab),
    [filteredGrouped, statusTab],
  );
  const visibleCount = useMemo(
    () => visibleGrouped.reduce((n, g) => n + g.items.length, 0),
    [visibleGrouped],
  );

  useEffect(() => {
    if (statusTab === "all") return;
    if (!filteredGrouped.some((group) => group.status === statusTab)) {
      setStatusTab("all");
    }
  }, [filteredGrouped, statusTab]);

  function onStatusTabDragStart(
    status: string,
    e: DragEvent<HTMLButtonElement>,
  ) {
    dragStatusRef.current = status;
    setDraggingStatus(status);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", status);
  }

  function onStatusTabDragEnd() {
    dragStatusRef.current = null;
    setDraggingStatus(null);
  }

  function onStatusTabDrop(
    targetStatus: string,
    e: DragEvent<HTMLButtonElement>,
  ) {
    e.preventDefault();
    const from =
      e.dataTransfer.getData("text/plain") || dragStatusRef.current || "";
    if (!from || from === targetStatus) {
      onStatusTabDragEnd();
      return;
    }
    const visibleOrder = filteredGrouped.map((group) => group.status);
    const reordered = reorderStatusTab(visibleOrder, from, targetStatus);
    saveJiraStatusTabOrder(mergeStatusTabOrder(statusTabOrder, reordered));
    onStatusTabDragEnd();
  }

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
    setAssigneeDraft("");
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
      <PageShell width="full">
        <PageHeader title="Jira" subtitle="Connect your Atlassian site" />
        <Card padding="default" variant="streamJira">
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md">
              No connected account
            </CardTitle>
            <CardDescription className="text-stream-jira-fg/80">
              Link your Jira site to triage assigned issues beside PR review.
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
    <PageShell width="full" className="gap-5">
      <PageHeader
        title="Jira"
        subtitle={`Engineering issues · ${connected.displayName} · ${connected.host.replace(/^https:\/\//, "")}`}
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

      <Card padding="default" className="border-stream-jira-border/70">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md font-semibold">
            Issue workspace
          </CardTitle>
          <CardDescription>
            Filter with saved views, type, labels, and JQL. Status tabs stay
            grounded in the live result set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              <IconButton
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Clear filter"
                title="Clear filter"
                onClick={resetToMyWork}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
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
                        <img
                          src={type.iconUrl}
                          alt=""
                          className="h-3.5 w-3.5"
                        />
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
            <Input
              value={assigneeDraft}
              onChange={(e) => setAssigneeDraft(e.target.value)}
              placeholder="Assignee…"
              aria-label="Filter by assignee"
              className="h-8 w-36 text-xs"
            />
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

          <Input
            value={extraJql}
            onChange={(e) => {
              setExtraJql(e.target.value);
              onControlChange();
            }}
            placeholder="Search / extra JQL — e.g. labels = ttd-fe-88"
            aria-label="Search or JQL"
            className="font-mono text-xs"
          />

          {labels.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="border-stream-jira-border bg-stream-jira text-stream-jira-fg rounded-full border px-2 py-0.5 text-xs"
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
                  className="border-border bg-surface-container-low text-on-surface rounded-md border px-2 py-0.5 text-xs"
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
            <div className="border-border bg-surface-container-low/50 space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-sm text-on-surface-variant font-semibold tracking-wide uppercase">
                  Filter configuration
                </p>
                <IconButton
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Close configuration"
                  onClick={() => setConfigureOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
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
                <p className="text-body-sm text-on-surface-variant">
                  Your assignee clause is used as written — not limited to
                  currentUser() only.
                </p>
              ) : null}
              <p className="text-on-surface-variant font-mono text-xs break-all">
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

          {jqlError ? <ErrorBlock tone="warning">{jqlError}</ErrorBlock> : null}
        </CardContent>
      </Card>

      {issues.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList
            aria-label="Jira workflow"
            className="h-auto max-w-full flex-wrap justify-start overflow-x-auto"
          >
            <TabsTrigger
              id="jira-tab-all"
              aria-controls="jira-tab-panel"
              active={statusTab === "all"}
              onClick={() => setStatusTab("all")}
            >
              All
              <span className="text-on-surface-variant tabular-nums">
                {assigneeNeedle ? visibleCount : issues.length}
              </span>
            </TabsTrigger>
            {filteredGrouped.map((group) => {
              const selected = statusTab === group.status;
              const dragging = draggingStatus === group.status;
              return (
                <TabsTrigger
                  key={group.status}
                  id={`jira-tab-${group.status}`}
                  aria-controls="jira-tab-panel"
                  aria-grabbed={dragging || undefined}
                  title="Drag to reorder status tabs"
                  draggable
                  active={selected}
                  onClick={() => setStatusTab(group.status)}
                  onDragStart={(e) => onStatusTabDragStart(group.status, e)}
                  onDragEnd={onStatusTabDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => onStatusTabDrop(group.status, e)}
                  className={cn(
                    "cursor-grab active:cursor-grabbing",
                    dragging && "opacity-50",
                  )}
                >
                  {group.status}
                  <span className="text-on-surface-variant tabular-nums">
                    {group.items.length}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <p className="font-keycap text-body-sm text-on-surface-variant">
            {visibleCount} result{visibleCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      <TabsPanel
        id="jira-tab-panel"
        aria-labelledby={
          statusTab === "all" ? "jira-tab-all" : `jira-tab-${statusTab}`
        }
      >
        <Card padding="none" className="overflow-hidden">
          {loading && issues.length === 0 ? (
            <LoadingBlock embedded>Loading Jira issues…</LoadingBlock>
          ) : visibleGrouped.length === 0 ? (
            <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
              No issues match this filter.
            </p>
          ) : (
            visibleGrouped.map((group) => (
              <div key={group.status}>
                {statusTab === "all" ? (
                  <div className="border-border bg-surface-container-low/60 text-label-sm text-on-surface-variant border-b px-3 py-2 font-semibold tracking-wide uppercase">
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
        </Card>

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
      </TabsPanel>
    </PageShell>
  );
}
