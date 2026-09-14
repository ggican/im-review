import { api } from "@/lib/api";
import { getJiraPublic } from "@/lib/settings";

import { adfToText } from "./adf";
import {
  formatJiraValue,
  listJiraProperties,
  matchDevDateFieldIds,
  matchStoryPointsFieldId,
  parseStoryPoints,
} from "./fields";
import { sortIssueTypeNames, uniqueIssueTypes } from "./jql";
import type {
  JiraIssue,
  JiraIssueDetail,
  JiraIssueType,
  JiraParent,
  JiraRemoteFilter,
  JiraSearchPage,
  JiraStatus,
  JiraStatusCategory,
  JiraTransition,
} from "./types";

const SEARCH_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "parent",
  "labels",
  "assignee",
  "priority",
  "updated",
  "created",
  "project",
];

type ExtraFieldIds = {
  start: string | null;
  end: string | null;
  storyPoints: string | null;
};

let extraFieldIdsPromise: Promise<ExtraFieldIds> | null = null;

async function resolveExtraFieldIds(): Promise<ExtraFieldIds> {
  if (!extraFieldIdsPromise) {
    extraFieldIdsPromise = api
      .jiraRequest<Array<{ id?: string; name?: string }>>(
        "GET",
        "/rest/api/3/field",
      )
      .then((list) => {
        const catalog = (Array.isArray(list) ? list : []).map((f) => ({
          id: String(f.id ?? ""),
          name: String(f.name ?? ""),
        }));
        return {
          ...matchDevDateFieldIds(catalog),
          storyPoints: matchStoryPointsFieldId(catalog),
        };
      })
      .catch(() => ({ start: null, end: null, storyPoints: null }));
  }
  return extraFieldIdsPromise;
}

function browseUrl(key: string): string {
  const host = getJiraPublic()?.host ?? "";
  const base = host.replace(/\/$/, "");
  return `${base}/browse/${key}`;
}

function categoryOf(raw: unknown): JiraStatusCategory {
  const key =
    raw && typeof raw === "object"
      ? String((raw as { key?: string }).key ?? "")
      : "";
  if (key === "new") return "new";
  if (key === "indeterminate") return "indeterminate";
  if (key === "done") return "done";
  return "unknown";
}

function mapStatus(raw: unknown): JiraStatus {
  const s = (raw ?? {}) as {
    id?: string;
    name?: string;
    statusCategory?: { key?: string; colorName?: string };
  };
  return {
    id: String(s.id ?? ""),
    name: s.name ?? "Unknown",
    category: categoryOf(s.statusCategory),
    colorName: s.statusCategory?.colorName,
  };
}

function mapType(raw: unknown): JiraIssueType {
  const t = (raw ?? {}) as {
    id?: string;
    name?: string;
    iconUrl?: string;
    subtask?: boolean;
  };
  return {
    id: String(t.id ?? ""),
    name: t.name ?? "Issue",
    iconUrl: t.iconUrl ?? "",
    subtask: Boolean(t.subtask),
  };
}

function mapParent(raw: unknown): JiraParent {
  if (raw == null || typeof raw !== "object") return null;
  const p = raw as {
    key?: string;
    fields?: {
      summary?: string;
      issuetype?: { name?: string; subtask?: boolean };
    };
  };
  if (!p.key) return null;
  return {
    key: p.key,
    summary: p.fields?.summary ?? "",
    typeName: p.fields?.issuetype?.name ?? "Issue",
    typeSubtask: Boolean(p.fields?.issuetype?.subtask),
  };
}

function avatarOf(assignee: unknown): string {
  if (assignee == null || typeof assignee !== "object") return "";
  const a = assignee as { avatarUrls?: Record<string, string> };
  return a.avatarUrls?.["48x48"] ?? a.avatarUrls?.["24x24"] ?? "";
}

export function mapJiraIssue(
  raw: {
    id?: string;
    key?: string;
    fields?: Record<string, unknown>;
  },
  dateIds?: ExtraFieldIds,
): JiraIssue {
  const fields = raw.fields ?? {};
  const assignee = fields.assignee as
    { displayName?: string } | null | undefined;
  const labels = Array.isArray(fields.labels)
    ? fields.labels.filter((l): l is string => typeof l === "string")
    : [];
  const priority =
    fields.priority && typeof fields.priority === "object"
      ? String((fields.priority as { name?: string }).name ?? "") || null
      : null;
  const startId = dateIds?.start;
  const endId = dateIds?.end;
  const pointsId = dateIds?.storyPoints;
  return {
    id: String(raw.id ?? raw.key ?? ""),
    key: String(raw.key ?? ""),
    summary: String(fields.summary ?? "(no summary)"),
    status: mapStatus(fields.status),
    type: mapType(fields.issuetype),
    parent: mapParent(fields.parent),
    labels,
    assignee: assignee
      ? {
          displayName: assignee.displayName ?? "Unknown",
          avatarUrl: avatarOf(assignee),
        }
      : null,
    priority,
    updatedAt: String(fields.updated ?? ""),
    browseUrl: browseUrl(String(raw.key ?? "")),
    devStart: startId ? formatJiraValue(fields[startId]) || null : null,
    devEnd: endId ? formatJiraValue(fields[endId]) || null : null,
    storyPoints: pointsId ? parseStoryPoints(fields[pointsId]) : null,
  };
}

const SEARCH_MAX_PAGES = 3;
const SEARCH_PAGE_SIZE = 100;

export async function searchJiraIssues(
  jql: string,
  nextPageToken?: string | null,
): Promise<JiraSearchPage> {
  const extraIds = await resolveExtraFieldIds();
  const fields = [
    ...SEARCH_FIELDS,
    extraIds.start,
    extraIds.end,
    extraIds.storyPoints,
  ].filter((id): id is string => Boolean(id));
  const data = await api.jiraRequest<{
    issues?: Array<{
      id?: string;
      key?: string;
      fields?: Record<string, unknown>;
    }>;
    nextPageToken?: string;
    isLast?: boolean;
  }>("POST", "/rest/api/3/search/jql", {
    jql,
    maxResults: SEARCH_PAGE_SIZE,
    fields,
    ...(nextPageToken ? { nextPageToken } : {}),
  });
  const issues = (data.issues ?? []).map((raw) => mapJiraIssue(raw, extraIds));
  return {
    issues,
    nextPageToken: data.nextPageToken ?? null,
    isLast: Boolean(data.isLast) || !data.nextPageToken,
  };
}

export async function searchJiraIssuesAll(jql: string): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let token: string | null = null;
  for (let page = 0; page < SEARCH_MAX_PAGES; page += 1) {
    const batch = await searchJiraIssues(jql, token);
    all.push(...batch.issues);
    if (batch.isLast || !batch.nextPageToken) break;
    token = batch.nextPageToken;
  }
  return all;
}

export async function fetchJiraIssueTypes(): Promise<JiraIssueType[]> {
  const raw = await api.jiraRequest<
    Array<{ id?: string; name?: string; iconUrl?: string; subtask?: boolean }>
  >("GET", "/rest/api/3/issuetype");
  const list = uniqueIssueTypes((Array.isArray(raw) ? raw : []).map(mapType));
  return sortIssueTypeNames(list);
}

export async function suggestJiraLabels(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) {
    const raw = await api.jiraRequest<{ values?: string[] }>(
      "GET",
      "/rest/api/3/label?maxResults=50",
    );
    return raw.values ?? [];
  }
  const raw = await api.jiraRequest<{ results?: Array<{ value?: string }> }>(
    "GET",
    `/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=${encodeURIComponent(q)}`,
  );
  return (raw.results ?? [])
    .map((r) => r.value)
    .filter((v): v is string => Boolean(v));
}

export async function fetchJiraIssueDetail(
  key: string,
): Promise<JiraIssueDetail> {
  const raw = await api.jiraRequest<{
    id?: string;
    key?: string;
    fields?: Record<string, unknown>;
    names?: Record<string, string>;
  }>(
    "GET",
    `/rest/api/3/issue/${encodeURIComponent(key)}?expand=names&fields=*all`,
  );
  const fields = raw.fields ?? {};
  const names = raw.names ?? {};
  const catalog = Object.entries(names).map(([id, name]) => ({ id, name }));
  const extraIds = {
    ...matchDevDateFieldIds(catalog),
    storyPoints: matchStoryPointsFieldId(catalog),
  };
  const issue = mapJiraIssue(raw, extraIds);
  const project =
    fields.project && typeof fields.project === "object"
      ? String((fields.project as { key?: string }).key ?? "")
      : "";
  const subtasks = Array.isArray(fields.subtasks)
    ? fields.subtasks
        .map((s) =>
          s && typeof s === "object"
            ? String((s as { key?: string }).key ?? "")
            : "",
        )
        .filter(Boolean)
    : [];
  const named = (id: string | null) =>
    id
      ? {
          id,
          name: names[id] ?? id,
          text: formatJiraValue(fields[id]),
        }
      : null;
  return {
    ...issue,
    descriptionText: adfToText(fields.description).trim(),
    projectKey: project,
    subtaskKeys: subtasks,
    properties: listJiraProperties(fields, names),
    devStartField: named(extraIds.start),
    devEndField: named(extraIds.end),
  };
}

export async function fetchJiraTransitions(
  key: string,
): Promise<JiraTransition[]> {
  const raw = await api.jiraRequest<{
    transitions?: Array<{
      id?: string;
      name?: string;
      to?: { name?: string };
    }>;
  }>("GET", `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  return (raw.transitions ?? [])
    .map((t) => ({
      id: String(t.id ?? ""),
      name: t.name ?? "Transition",
      toName: t.to?.name ?? t.name ?? "Status",
    }))
    .filter((t) => t.id);
}

export async function transitionJiraIssue(
  key: string,
  transitionId: string,
): Promise<void> {
  await api.jiraRequest(
    "POST",
    `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`,
    { transition: { id: transitionId } },
  );
}

function mapRemoteFilter(raw: {
  id?: string | number;
  name?: string;
  jql?: string;
  favourite?: boolean;
}): JiraRemoteFilter {
  return {
    id: String(raw.id ?? ""),
    name: raw.name ?? "Untitled",
    jql: raw.jql ?? "",
    favourite: Boolean(raw.favourite),
  };
}

export async function fetchRemoteJiraFilters(): Promise<JiraRemoteFilter[]> {
  const [mine, fav] = await Promise.all([
    api.jiraRequest<unknown>("GET", "/rest/api/3/filter/my").catch(() => []),
    api
      .jiraRequest<unknown>("GET", "/rest/api/3/filter/favourite")
      .catch(() => []),
  ]);
  const seen = new Set<string>();
  const out: JiraRemoteFilter[] = [];
  for (const list of [mine, fav]) {
    const arr = Array.isArray(list) ? list : [];
    for (const item of arr) {
      const mapped = mapRemoteFilter(
        (item ?? {}) as {
          id?: string | number;
          name?: string;
          jql?: string;
          favourite?: boolean;
        },
      );
      if (!mapped.id || seen.has(mapped.id) || !mapped.jql) continue;
      seen.add(mapped.id);
      out.push(mapped);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveFilterToJira(input: {
  name: string;
  jql: string;
  jiraFilterId?: string;
}): Promise<string> {
  if (input.jiraFilterId) {
    const raw = await api.jiraRequest<{ id?: string | number }>(
      "PUT",
      `/rest/api/3/filter/${encodeURIComponent(input.jiraFilterId)}`,
      { name: input.name, jql: input.jql, favourite: true },
    );
    return String(raw.id ?? input.jiraFilterId);
  }
  const raw = await api.jiraRequest<{ id?: string | number }>(
    "POST",
    "/rest/api/3/filter",
    { name: input.name, jql: input.jql, favourite: true },
  );
  return String(raw.id ?? "");
}

export function jiraErrorMessage(err: unknown): string {
  const text = String(err);
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart)) as {
        errorMessages?: string[];
        errors?: Record<string, string>;
      };
      const msgs = [
        ...(parsed.errorMessages ?? []),
        ...Object.values(parsed.errors ?? {}),
      ].filter(Boolean);
      if (msgs.length > 0) return msgs.join(" ");
    } catch {
      // fall through
    }
  }
  return text.replace(/^jira error \d+:\s*/i, "") || "Jira request failed";
}

export function groupIssuesByStatus(
  issues: JiraIssue[],
): Array<{ status: string; category: JiraStatusCategory; items: JiraIssue[] }> {
  const order: JiraStatusCategory[] = [
    "indeterminate",
    "new",
    "unknown",
    "done",
  ];
  const map = new Map<string, JiraIssue[]>();
  const meta = new Map<string, JiraStatusCategory>();
  for (const issue of issues) {
    const name = issue.status.name;
    const list = map.get(name) ?? [];
    list.push(issue);
    map.set(name, list);
    if (!meta.has(name)) meta.set(name, issue.status.category);
  }
  return [...map.entries()]
    .map(([status, items]) => ({
      status,
      category: meta.get(status) ?? "unknown",
      items,
    }))
    .sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      if (ai !== bi) return ai - bi;
      return a.status.localeCompare(b.status);
    });
}
