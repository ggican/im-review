import type { PullRequest, ReviewEvent } from "@/features/pr/types";
import { api } from "@/lib/api";

import {
  normalizeReviewPath,
  rightSideLinesFromPatch,
  snapToCommentableLine,
} from "./diff-lines";
import type { AiFinding, AiReviewDraft, AiSeverity } from "./types";

export type ChangedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

type GhFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes?: number;
  patch?: string;
};

const MAX_FILES_FOR_AI = 20;
const MAX_PATCH_CHARS = 48_000;

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo: ${repo}`);
  return { owner, name };
}

export async function fetchChangedFiles(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<ChangedFile[]> {
  const { owner, name } = splitRepo(pr.repo);
  const files = await api.githubGet<GhFile[]>(
    `/repos/${owner}/${name}/pulls/${pr.number}/files?per_page=100`,
  );
  return (files ?? []).map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    changes: f.changes ?? f.additions + f.deletions,
    patch: f.patch,
  }));
}

/** Build truncated patch text for Cursor (from already-fetched files). */
export function buildPatchContext(files: ChangedFile[]): {
  text: string;
  fileCount: number;
} {
  const parts: string[] = [];
  let total = 0;
  let fileCount = 0;
  for (const f of files) {
    if (fileCount >= MAX_FILES_FOR_AI) break;
    const header = `--- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n`;
    const patch = f.patch ?? "(binary or too large — no patch)";
    const chunk = header + patch + "\n\n";
    if (total + chunk.length > MAX_PATCH_CHARS) break;
    parts.push(chunk);
    total += chunk.length;
    fileCount += 1;
  }
  return { text: parts.join(""), fileCount };
}

export async function fetchPatchContext(pr: PullRequest): Promise<{
  text: string;
  fileCount: number;
  files: ChangedFile[];
}> {
  const files = await fetchChangedFiles(pr);
  const ctx = buildPatchContext(files);
  return { ...ctx, files };
}

function asSeverity(v: unknown): AiSeverity {
  if (v === "critical" || v === "warning" || v === "info") return v;
  return "info";
}

function asEvent(v: unknown): ReviewEvent {
  if (v === "APPROVE" || v === "REQUEST_CHANGES" || v === "COMMENT") return v;
  return "COMMENT";
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fenced block */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Could not parse AI JSON response");
}

export function parseAiReviewText(
  text: string,
  pr: PullRequest,
): AiReviewDraft {
  let summary = text.trim() || "No summary returned.";
  let findings: AiFinding[];
  let suggestedEvent: ReviewEvent = "COMMENT";

  try {
    const raw = extractJsonObject(text) as {
      summary?: string;
      suggestedEvent?: string;
      findings?: Array<{
        severity?: string;
        title?: string;
        body?: string;
        path?: string;
        line?: number;
      }>;
    };
    if (typeof raw.summary === "string" && raw.summary.trim()) {
      summary = raw.summary.trim();
    }
    suggestedEvent = asEvent(raw.suggestedEvent);
    findings = (raw.findings ?? []).map((f, i) => ({
      id: `f_${i}_${Date.now().toString(36)}`,
      severity: asSeverity(f.severity),
      title: (f.title ?? `Finding ${i + 1}`).trim() || `Finding ${i + 1}`,
      body: (f.body ?? "").trim() || "(no details)",
      path: f.path,
      line: typeof f.line === "number" ? f.line : undefined,
      included: true,
    }));
  } catch {
    findings = [
      {
        id: `f_raw_${Date.now().toString(36)}`,
        severity: "info",
        title: "AI review (unstructured)",
        body: text.trim() || "(empty)",
        included: true,
      },
    ];
  }

  return {
    prKey: `${pr.repo}#${pr.number}`,
    summary,
    findings,
    suggestedEvent,
    rawText: text,
    createdAt: new Date().toISOString(),
  };
}

function findingMarkdown(f: AiFinding): string {
  const loc =
    f.path != null
      ? ` (\`${f.path}${f.line != null ? `:${f.line}` : ""}\`)`
      : "";
  return `### ${f.severity.toUpperCase()}: ${f.title}${loc}\n${f.body}`;
}

function inlineCommentBody(f: AiFinding): string {
  return `**${f.severity.toUpperCase()}: ${f.title}**\n\n${f.body}`;
}

/**
 * Build GitHub review payload: overall body + inline comments on diff lines.
 * Findings without a mappable path/line stay in the review body.
 */
export function buildGithubReviewPayload(
  draft: AiReviewDraft,
  files: ChangedFile[],
): {
  body: string;
  comments: Array<{ path: string; line: number; side: "RIGHT"; body: string }>;
  inlineCount: number;
  bodyOnlyCount: number;
} {
  const selected = draft.findings.filter((f) => f.included);
  const byPath = new Map(
    files.map((f) => [normalizeReviewPath(f.filename), f] as const),
  );
  const comments: Array<{
    path: string;
    line: number;
    side: "RIGHT";
    body: string;
  }> = [];
  const bodyOnly: AiFinding[] = [];

  for (const f of selected) {
    if (!f.path || f.line == null || !Number.isFinite(f.line)) {
      bodyOnly.push(f);
      continue;
    }
    const path = normalizeReviewPath(f.path);
    const file = byPath.get(path);
    if (!file?.patch) {
      bodyOnly.push(f);
      continue;
    }
    const commentable = rightSideLinesFromPatch(file.patch);
    const line = snapToCommentableLine(Math.trunc(f.line), commentable);
    if (line == null) {
      bodyOnly.push(f);
      continue;
    }
    comments.push({
      path,
      line,
      side: "RIGHT",
      body: inlineCommentBody(f),
    });
  }

  const lines: string[] = [];
  lines.push(draft.summary.trim() || "AI review draft");
  if (bodyOnly.length) {
    lines.push("");
    lines.push(
      "_Findings below could not be attached as inline comments (missing/out-of-diff line):_",
    );
    lines.push("");
    for (const f of bodyOnly) {
      lines.push(findingMarkdown(f));
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(
    "_Draft generated with Cursor AI via IM Review — human reviewed before submit._",
  );

  return {
    body: lines.join("\n").trim(),
    comments,
    inlineCount: comments.length,
    bodyOnlyCount: bodyOnly.length,
  };
}

/** Plain markdown body (all findings). Prefer buildGithubReviewPayload for submit. */
export function draftToReviewBody(draft: AiReviewDraft): string {
  const selected = draft.findings.filter((f) => f.included);
  const lines: string[] = [];
  lines.push(draft.summary.trim());
  if (selected.length) {
    lines.push("");
    for (const f of selected) {
      lines.push(findingMarkdown(f));
      lines.push("");
    }
  }
  lines.push("---");
  lines.push(
    "_Draft generated with Cursor AI via IM Review — human reviewed before submit._",
  );
  return lines.join("\n").trim();
}

/** JSON sent to Cursor refine (includes only included findings by default). */
export function draftToRefineJson(
  draft: AiReviewDraft,
  onlyIncluded = false,
): string {
  const findings = onlyIncluded
    ? draft.findings.filter((f) => f.included)
    : draft.findings;
  return JSON.stringify(
    {
      summary: draft.summary,
      suggestedEvent: draft.suggestedEvent,
      findings: findings.map((f) => ({
        severity: f.severity,
        title: f.title,
        body: f.body,
        path: f.path,
        line: f.line,
      })),
    },
    null,
    2,
  );
}
