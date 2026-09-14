import { api } from "@/lib/api";

import type {
  GmailLabel,
  GmailListPage,
  GmailMessage,
  GmailMessageSummary,
  GmailTab,
} from "./types";

const LIST_HEADERS = ["From", "Subject", "Date"];
const MAX_LIST = 25;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function headerValue(
  headers: unknown,
  name: string,
): string {
  if (!Array.isArray(headers)) return "";
  for (const item of headers) {
    const rec = asRecord(item);
    if (!rec) continue;
    if (String(rec.name ?? "").toLowerCase() === name.toLowerCase()) {
      return String(rec.value ?? "");
    }
  }
  return "";
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized;
  try {
    return decodeURIComponent(
      [...atob(padded)]
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    try {
      return atob(padded);
    } catch {
      return "";
    }
  }
}

function extractBodies(payload: unknown): {
  text: string | null;
  html: string | null;
} {
  const rec = asRecord(payload);
  if (!rec) return { text: null, html: null };

  let text: string | null = null;
  let html: string | null = null;

  function walk(node: unknown) {
    const part = asRecord(node);
    if (!part) return;
    const mime = String(part.mimeType ?? "");
    const body = asRecord(part.body);
    const data = typeof body?.data === "string" ? body.data : "";
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mime === "text/plain" && !text) text = decoded;
      if (mime === "text/html" && !html) html = decoded;
    }
    const parts = part.parts;
    if (Array.isArray(parts)) {
      for (const child of parts) walk(child);
    }
  }

  walk(rec);
  return { text, html };
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function tabToQuery(tab: GmailTab): string {
  switch (tab) {
    case "inbox":
      return "label:inbox";
    case "unread":
      return "label:inbox is:unread";
    case "starred":
      return "is:starred";
    case "sent":
      return "label:sent";
    default:
      return "label:inbox";
  }
}

export function buildGmailQuery(tab: GmailTab, search: string): string {
  const parts = [tabToQuery(tab)];
  const q = search.trim();
  if (q) parts.push(q);
  return parts.join(" ");
}

export function gmailPermalink(messageId: string): string {
  return `https://mail.google.com/mail/#inbox/${encodeURIComponent(messageId)}`;
}

export function mapGmailLabel(raw: unknown): GmailLabel | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = String(rec.id ?? "");
  if (!id) return null;
  const type = rec.type === "system" ? "system" : "user";
  return {
    id,
    name: String(rec.name ?? id),
    type,
  };
}

function mapSummary(raw: unknown): GmailMessageSummary | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = String(rec.id ?? "");
  if (!id) return null;
  const payload = asRecord(rec.payload);
  const headers = payload?.headers;
  const labelIds = Array.isArray(rec.labelIds)
    ? rec.labelIds.filter((l): l is string => typeof l === "string")
    : [];
  const internalDate = Number(rec.internalDate ?? 0);
  const dateMs = internalDate > 0 ? internalDate : Date.now();
  const date =
    headerValue(headers, "Date") ||
    new Date(dateMs).toISOString();
  return {
    id,
    threadId: String(rec.threadId ?? ""),
    subject: headerValue(headers, "Subject") || "(No subject)",
    from: headerValue(headers, "From") || "Unknown",
    snippet: String(rec.snippet ?? ""),
    date,
    dateMs,
    labelIds,
    unread: labelIds.includes("UNREAD"),
    starred: labelIds.includes("STARRED"),
  };
}

export function mapGmailMessage(raw: unknown): GmailMessage | null {
  const summary = mapSummary(raw);
  if (!summary) return null;
  const rec = asRecord(raw);
  const payload = asRecord(rec?.payload);
  const headers = payload?.headers;
  const { text, html } = extractBodies(payload);
  return {
    ...summary,
    to: headerValue(headers, "To"),
    cc: headerValue(headers, "Cc"),
    bodyText: text,
    bodyHtml: html ? sanitizeHtml(html) : null,
    permalink: gmailPermalink(summary.id),
  };
}

async function fetchMessageSummaries(ids: string[]): Promise<GmailMessageSummary[]> {
  if (ids.length === 0) return [];
  const rows = await Promise.all(
    ids.map((id) =>
      api.gmailGetMessage(id, "metadata", LIST_HEADERS).catch(() => null),
    ),
  );
  return rows
    .map(mapSummary)
    .filter((msg): msg is GmailMessageSummary => msg != null);
}

export async function fetchGmailMessages(input: {
  tab: GmailTab;
  search?: string;
  labelId?: string;
  pageToken?: string | null;
}): Promise<GmailListPage> {
  const query = buildGmailQuery(input.tab, input.search ?? "");
  const labelIds = input.labelId?.trim() ? [input.labelId.trim()] : undefined;
  const data = await api.gmailListMessages({
    query,
    labelIds,
    pageToken: input.pageToken ?? null,
    maxResults: MAX_LIST,
  });
  const rec = asRecord(data);
  const refs = Array.isArray(rec?.messages) ? rec.messages : [];
  const ids = refs
    .map((item) => String(asRecord(item)?.id ?? ""))
    .filter(Boolean);
  const messages = await fetchMessageSummaries(ids);
  const nextPageToken =
    typeof rec?.nextPageToken === "string" ? rec.nextPageToken : null;
  return { messages, nextPageToken };
}

export async function fetchGmailMessage(id: string): Promise<GmailMessage> {
  const raw = await api.gmailGetMessage(id, "full");
  const mapped = mapGmailMessage(raw);
  if (!mapped) throw new Error("Could not parse Gmail message");
  return mapped;
}

export async function fetchGmailLabels(): Promise<GmailLabel[]> {
  const raw = await api.gmailListLabels();
  const rec = asRecord(raw);
  const labels = Array.isArray(rec?.labels) ? rec.labels : [];
  return labels
    .map(mapGmailLabel)
    .filter((label): label is GmailLabel => label != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function markGmailRead(id: string, read: boolean): Promise<void> {
  await api.gmailModifyMessage(id, {
    addLabelIds: read ? [] : ["UNREAD"],
    removeLabelIds: read ? ["UNREAD"] : [],
  });
}

export async function starGmailMessage(
  id: string,
  starred: boolean,
): Promise<void> {
  await api.gmailModifyMessage(id, {
    addLabelIds: starred ? ["STARRED"] : [],
    removeLabelIds: starred ? [] : ["STARRED"],
  });
}

export async function archiveGmailMessage(id: string): Promise<void> {
  await api.gmailModifyMessage(id, {
    removeLabelIds: ["INBOX"],
  });
}

export function gmailErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const lower = text.toLowerCase();
  if (lower.includes("403") && lower.includes("gmail")) {
    return "Gmail API is disabled or access was denied. Enable Gmail API in Google Cloud Console, then reconnect in Settings.";
  }
  if (lower.includes("403") || lower.includes("insufficient")) {
    return "Gmail access not granted. Reconnect Google in Settings to approve Gmail scopes.";
  }
  return (
    text
      .replace(/^google error \d+:\s*/i, "")
      .replace(/^google oauth:\s*/i, "") || "Gmail request failed"
  );
}

export function needsGmailReconnect(err: unknown): boolean {
  const text = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    text.includes("403") ||
    text.includes("insufficient") ||
    text.includes("scope")
  );
}
