import { adfToText } from "./adf";
import type { JiraFieldProperty } from "./types";

export type JiraFieldCatalogItem = {
  id: string;
  name: string;
};

const MAX_TEXT = 4000;
const SKIP_OBJECT_KEYS = new Set([
  "self",
  "avatarUrls",
  "iconUrl",
  "accountId",
  "accountType",
  "active",
  "timeZone",
  "locale",
  "expand",
]);

export function isDevStartName(name: string): boolean {
  return /\bdev(?:elopment)?\s*start\b/i.test(name.trim());
}

export function isDevEndName(name: string): boolean {
  return /\bdev(?:elopment)?\s*end\b/i.test(name.trim());
}

export function matchDevDateFieldIds(fields: JiraFieldCatalogItem[]): {
  start: string | null;
  end: string | null;
} {
  const start =
    fields.find(
      (f) =>
        isDevStartName(f.name) &&
        !/ops|qa|product|story|epic|gantt|baseline|ticket|estimated|actual|original|change|dba/i.test(
          f.name,
        ),
    ) ?? fields.find((f) => isDevStartName(f.name));
  const end =
    fields.find(
      (f) =>
        isDevEndName(f.name) &&
        !/ops|qa|product|story|epic|gantt|baseline|ticket|estimated|actual|original|change|dba/i.test(
          f.name,
        ),
    ) ?? fields.find((f) => isDevEndName(f.name));
  return { start: start?.id ?? null, end: end?.id ?? null };
}

export function isStoryPointsName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "story points" ||
    n === "story point" ||
    n === "story point estimate" ||
    n === "story points estimate"
  );
}

export function matchStoryPointsFieldId(
  fields: JiraFieldCatalogItem[],
): string | null {
  const exact = fields.find((f) => /^story\s*points?$/i.test(f.name.trim()));
  if (exact) return exact.id;
  return fields.find((f) => isStoryPointsName(f.name))?.id ?? null;
}

export function parseStoryPoints(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === "object" && "value" in value) {
    return parseStoryPoints((value as { value: unknown }).value);
  }
  return null;
}

export function formatJiraValue(value: unknown, depth = 0): string {
  if (value == null || value === "") return "";
  if (depth > 5) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return value.replace("T", " ").replace(/\.\d+Z$/, " UTC");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatJiraValue(item, depth + 1))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value !== "object") return "";
  const o = value as Record<string, unknown>;
  if (o.type === "doc" || Array.isArray(o.content)) {
    return adfToText(value).trim();
  }
  if (typeof o.displayName === "string") return o.displayName;
  if (typeof o.value === "string" && (o.id != null || o.self)) return o.value;
  if (typeof o.name === "string" && (o.key || o.id || o.statusCategory)) {
    return o.name;
  }
  if (typeof o.key === "string") {
    const summary =
      o.fields && typeof o.fields === "object"
        ? String((o.fields as { summary?: string }).summary ?? "")
        : "";
    return summary ? `${o.key} — ${summary}` : o.key;
  }
  if (typeof o.filename === "string") return o.filename;
  if (Array.isArray(o.comments)) {
    return o.comments
      .map((c) => {
        if (!c || typeof c !== "object") return "";
        const row = c as {
          author?: { displayName?: string };
          created?: string;
          body?: unknown;
        };
        const who = row.author?.displayName ?? "Comment";
        const when = row.created ? formatJiraValue(row.created, depth + 1) : "";
        const body = formatJiraValue(row.body, depth + 1);
        return [who, when, body].filter(Boolean).join(" · ");
      })
      .filter(Boolean)
      .join("\n");
  }
  if (o.originalEstimate || o.remainingEstimate || o.timeSpent) {
    return [
      o.originalEstimate ? `original ${String(o.originalEstimate)}` : "",
      o.remainingEstimate ? `remaining ${String(o.remainingEstimate)}` : "",
      o.timeSpent ? `spent ${String(o.timeSpent)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const parts = Object.entries(o)
    .filter(([k]) => !SKIP_OBJECT_KEYS.has(k))
    .map(([k, v]) => {
      const text = formatJiraValue(v, depth + 1);
      return text ? `${k}: ${text}` : "";
    })
    .filter(Boolean);
  return parts.join("; ");
}

function humanizeFieldId(id: string): string {
  if (id.startsWith("customfield_")) return id;
  return id
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function listJiraProperties(
  fields: Record<string, unknown>,
  names: Record<string, string>,
): JiraFieldProperty[] {
  const out: JiraFieldProperty[] = [];
  for (const [id, value] of Object.entries(fields)) {
    const text = formatJiraValue(value).slice(0, MAX_TEXT);
    if (!text) continue;
    out.push({
      id,
      name: names[id] || humanizeFieldId(id),
      text,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function pickNamedProperty(
  fields: Record<string, unknown>,
  names: Record<string, string>,
  test: (name: string) => boolean,
): JiraFieldProperty | null {
  const entry = Object.entries(names).find(([, name]) => test(name));
  if (!entry) return null;
  const [id, name] = entry;
  return {
    id,
    name,
    text: formatJiraValue(fields[id]),
  };
}
