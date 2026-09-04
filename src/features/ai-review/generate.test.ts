import { describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

vi.mock("@/lib/api", () => ({
  api: {
    githubGet: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import {
  buildGithubReviewPayload,
  buildPatchContext,
  type ChangedFile,
  draftToRefineJson,
  draftToReviewBody,
  fetchChangedFiles,
  fetchPatchContext,
  parseAiReviewText,
} from "./generate";
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, isAiProviderId } from "./providers";
import type { AiReviewDraft } from "./types";

const pr = makePr({ repo: "acme/web", number: 7 });

function draft(partial: Partial<AiReviewDraft> = {}): AiReviewDraft {
  return {
    prKey: "acme/web#7",
    summary: "Ship it",
    suggestedEvent: "COMMENT",
    rawText: "",
    createdAt: "2026-09-04T00:00:00.000Z",
    findings: [
      {
        id: "1",
        severity: "info",
        title: "Nit",
        body: "Rename var",
        included: true,
        path: "src/a.ts",
        line: 3,
      },
      {
        id: "2",
        severity: "warning",
        title: "Skip me",
        body: "Nope",
        included: false,
      },
    ],
    ...partial,
  };
}

describe("UNIT-AIREVIEW-006..010 parseAiReviewText", () => {
  it("parses structured JSON", () => {
    const result = parseAiReviewText(
      JSON.stringify({
        summary: "Looks good overall",
        suggestedEvent: "APPROVE",
        findings: [
          {
            severity: "warning",
            title: "Null check",
            body: "Handle null",
            path: "src/a.ts",
            line: 12,
          },
        ],
      }),
      pr,
    );
    expect(result.summary).toBe("Looks good overall");
    expect(result.suggestedEvent).toBe("APPROVE");
    expect(result.findings[0]?.severity).toBe("warning");
  });

  it("parses fenced json", () => {
    const result = parseAiReviewText(
      'Here:\n```json\n{"summary":"Ok","findings":[]}\n```',
      pr,
    );
    expect(result.summary).toBe("Ok");
    expect(result.findings).toEqual([]);
  });

  it("parses embedded object and defaults bad enums", () => {
    const result = parseAiReviewText(
      'prefix {"summary":"Embedded","suggestedEvent":"NOPE","findings":[{"severity":"lol","title":"","body":""}]} suffix',
      pr,
    );
    expect(result.summary).toBe("Embedded");
    expect(result.suggestedEvent).toBe("COMMENT");
    expect(result.findings[0]?.severity).toBe("info");
    expect(result.findings[0]?.title).toMatch(/Finding/);
    expect(result.findings[0]?.body).toBe("(no details)");
  });

  it("falls back for unstructured text", () => {
    const result = parseAiReviewText("plain prose without json", pr);
    expect(result.findings[0]?.title).toMatch(/unstructured/i);
  });
});

describe("UNIT-AIREVIEW-011/012 buildPatchContext", () => {
  it("includes patches and binary placeholder", () => {
    const files: ChangedFile[] = [
      {
        filename: "a.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: "@@ -1 +1 @@\n-a\n+b",
      },
      {
        filename: "b.ts",
        status: "added",
        additions: 2,
        deletions: 0,
        changes: 2,
      },
    ];
    const ctx = buildPatchContext(files);
    expect(ctx.fileCount).toBe(2);
    expect(ctx.text).toContain("--- a.ts");
    expect(ctx.text).toContain("no patch");
  });

  it("stops at max files", () => {
    const files = Array.from({ length: 25 }, (_, i) => ({
      filename: `f${i}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "+x",
    }));
    expect(buildPatchContext(files).fileCount).toBe(20);
  });
});

describe("UNIT-AIREVIEW-013..017 review payload helpers", () => {
  const file: ChangedFile = {
    filename: "src/a.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: ["@@ -1,4 +1,4 @@", " a", " b", "+c", " d"].join("\n"),
  };

  it("maps inline comments when line is commentable", () => {
    const payload = buildGithubReviewPayload(draft(), [file]);
    expect(payload.inlineCount).toBe(1);
    expect(payload.comments[0]?.line).toBe(3);
    expect(payload.bodyOnlyCount).toBe(0);
  });

  it("body-only when path/line missing or unmappable", () => {
    const payload = buildGithubReviewPayload(
      draft({
        findings: [
          {
            id: "x",
            severity: "info",
            title: "No loc",
            body: "x",
            included: true,
          },
          {
            id: "y",
            severity: "info",
            title: "Bad path",
            body: "y",
            included: true,
            path: "missing.ts",
            line: 1,
          },
          {
            id: "z",
            severity: "info",
            title: "Far line",
            body: "z",
            included: true,
            path: "src/a.ts",
            line: 999,
          },
        ],
      }),
      [file],
    );
    expect(payload.inlineCount).toBe(0);
    expect(payload.bodyOnlyCount).toBe(3);
    expect(payload.body).toContain("could not be attached");
  });

  it("draftToReviewBody skips excluded findings", () => {
    const body = draftToReviewBody(draft());
    expect(body).toContain("Ship it");
    expect(body).toContain("Nit");
    expect(body).not.toContain("Skip me");
  });

  it("draftToRefineJson respects onlyIncluded", () => {
    const all = JSON.parse(draftToRefineJson(draft(), false));
    const only = JSON.parse(draftToRefineJson(draft(), true));
    expect(all.findings).toHaveLength(2);
    expect(only.findings).toHaveLength(1);
  });
});

describe("mocked fetch helpers", () => {
  it("fetchChangedFiles maps github payload", async () => {
    vi.mocked(api.githubGet).mockResolvedValueOnce([
      {
        filename: "a.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: "+x",
      },
    ]);
    const files = await fetchChangedFiles(pr);
    expect(files[0]?.filename).toBe("a.ts");
  });

  it("fetchPatchContext composes files + text", async () => {
    vi.mocked(api.githubGet).mockResolvedValueOnce([
      {
        filename: "a.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        patch: "+x",
      },
    ]);
    const ctx = await fetchPatchContext(pr);
    expect(ctx.fileCount).toBe(1);
    expect(ctx.text).toContain("a.ts");
  });

  it("rejects invalid repo", async () => {
    await expect(
      fetchChangedFiles({ repo: "invalid", number: 1 }),
    ).rejects.toThrow(/Invalid repo/);
  });
});

describe("UNIT-AIREVIEW-018/019 providers", () => {
  it("validates ids and defaults", () => {
    expect(isAiProviderId("cursor")).toBe(true);
    expect(isAiProviderId("nope")).toBe(false);
    expect(DEFAULT_AI_PROVIDER).toBe("cursor");
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
