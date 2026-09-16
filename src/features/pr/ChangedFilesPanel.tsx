import { FileCode2, MessageSquarePlus, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ChangedFile } from "@/features/ai-review/generate";
import { cn } from "@/lib/cn";

import type { PendingInlineComment } from "./types";

type DiffLineKind = "hunk" | "add" | "del" | "ctx" | "meta";

type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

export function parsePatch(patch: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)/);
      if (m) {
        oldLine = Number.parseInt(m[1]!, 10);
        newLine = Number.parseInt(m[2]!, 10);
      }
      out.push({ kind: "hunk", text: raw, oldLine: null, newLine: null });
      continue;
    }
    if (raw.startsWith("\\")) {
      out.push({ kind: "meta", text: raw, oldLine: null, newLine: null });
      continue;
    }
    if (raw.startsWith("+")) {
      out.push({
        kind: "add",
        text: raw.slice(1),
        oldLine: null,
        newLine,
      });
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-")) {
      out.push({
        kind: "del",
        text: raw.slice(1),
        oldLine,
        newLine: null,
      });
      oldLine += 1;
      continue;
    }
    const text = raw.startsWith(" ") ? raw.slice(1) : raw;
    out.push({
      kind: "ctx",
      text,
      oldLine,
      newLine,
    });
    oldLine += 1;
    newLine += 1;
  }

  return out;
}

function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "Added";
    case "removed":
      return "Removed";
    case "renamed":
      return "Renamed";
    case "modified":
      return "Modified";
    default:
      return status;
  }
}

function statusBadgeVariant(
  status: string,
): "success" | "error" | "warning" | "github" | "outline" {
  switch (status) {
    case "added":
      return "success";
    case "removed":
      return "error";
    case "renamed":
      return "warning";
    case "modified":
      return "github";
    default:
      return "outline";
  }
}

function statusLetter(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "removed":
      return "D";
    case "renamed":
      return "R";
    case "modified":
      return "M";
    default:
      return status.slice(0, 1).toUpperCase() || "?";
  }
}

function newPendingId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ComposeTarget = { path: string; line: number };

function FileDiff({
  file,
  pendingForFile,
  onAddPending,
}: {
  file: ChangedFile;
  pendingForFile: PendingInlineComment[];
  onAddPending?: (comment: PendingInlineComment) => void;
}) {
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch) : []),
    [file.patch],
  );
  const [compose, setCompose] = useState<ComposeTarget | null>(null);
  const [draftBody, setDraftBody] = useState("");

  if (!file.patch) {
    return (
      <p className="text-body-sm text-on-surface-variant px-4 py-8 text-center">
        No patch available (binary file, or diff too large for the GitHub API).
      </p>
    );
  }

  function startCompose(line: number) {
    setCompose({ path: file.filename, line });
    setDraftBody("");
  }

  function addToPending() {
    if (!compose || !onAddPending) return;
    const trimmed = draftBody.trim();
    if (!trimmed) return;
    onAddPending({
      id: newPendingId(),
      path: compose.path,
      line: compose.line,
      side: "RIGHT",
      body: trimmed,
      source: "manual",
    });
    setCompose(null);
    setDraftBody("");
  }

  return (
    <div className="bg-surface-container-low/40 dark:bg-chrome/40 max-h-[min(32rem,60vh)] overflow-auto">
      <table className="w-full min-w-[40rem] border-collapse font-mono text-xs leading-5">
        <tbody>
          {lines.map((line, i) => {
            const commentable =
              Boolean(onAddPending) &&
              (line.kind === "add" || line.kind === "ctx") &&
              line.newLine != null;
            const pendingHere = pendingForFile.filter(
              (p) => p.line === line.newLine && p.side === "RIGHT",
            );
            const composingHere =
              compose?.line === line.newLine && compose.path === file.filename;

            return (
              <Fragment
                key={`${i}-${line.kind}-${line.oldLine}-${line.newLine}`}
              >
                <tr
                  className={cn(
                    "group",
                    line.kind === "add" &&
                      "bg-success-container/50 text-on-success-container dark:bg-emerald-950/45 dark:text-emerald-100",
                    line.kind === "del" &&
                      "bg-error-container/60 text-on-error-container dark:bg-red-950/40 dark:text-red-100",
                    line.kind === "hunk" &&
                      "bg-stream-github/70 text-stream-github-fg",
                    line.kind === "meta" &&
                      "text-on-surface-variant italic opacity-80",
                    line.kind === "ctx" && "text-on-surface",
                  )}
                >
                  <td className="border-border/60 w-8 border-r px-1 text-center align-top">
                    {commentable ? (
                      <button
                        type="button"
                        aria-label={`Add comment on line ${line.newLine}`}
                        className="text-on-surface-variant hover:bg-primary-container/30 hover:text-on-primary-container focus-visible:ring-primary-container mt-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() => startCompose(line.newLine!)}
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </td>
                  <td className="border-border/40 text-on-surface-variant/70 w-10 border-r px-2 text-right tabular-nums select-none">
                    {line.oldLine ?? ""}
                  </td>
                  <td className="border-border/40 text-on-surface-variant/70 w-10 border-r px-2 text-right tabular-nums select-none">
                    {line.newLine ?? ""}
                  </td>
                  <td
                    className={cn(
                      "w-4 px-1 text-center font-semibold select-none",
                      line.kind === "add" && "text-success",
                      line.kind === "del" && "text-error",
                    )}
                  >
                    {line.kind === "add" ? "+" : line.kind === "del" ? "−" : ""}
                  </td>
                  <td className="px-2 py-0.5 break-all whitespace-pre-wrap">
                    {line.kind === "hunk" ? line.text : line.text || " "}
                  </td>
                </tr>
                {pendingHere.map((p) => (
                  <tr
                    key={p.id}
                    className="bg-warning-container/70 dark:bg-amber-950/35"
                  >
                    <td
                      colSpan={5}
                      className="text-body-sm text-on-warning-container px-3 py-2"
                    >
                      Pending · L{p.line}: {p.body}
                    </td>
                  </tr>
                ))}
                {composingHere ? (
                  <tr className="bg-stream-github/40">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="space-y-2">
                        <p className="text-label-md text-stream-github-fg">
                          Draft comment on {file.filename}:{compose.line}{" "}
                          (RIGHT)
                        </p>
                        <Textarea
                          rows={3}
                          autoFocus
                          value={draftBody}
                          onChange={(e) => setDraftBody(e.currentTarget.value)}
                          placeholder="Leave a comment…"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="accent"
                            disabled={!draftBody.trim()}
                            onClick={addToPending}
                          >
                            Add to pending
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCompose(null);
                              setDraftBody("");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChangedFilesPanel({
  files,
  totals,
  pendingComments = [],
  onAddPending,
}: {
  files: ChangedFile[];
  totals: { add: number; del: number };
  pendingComments?: PendingInlineComment[];
  onAddPending?: (comment: PendingInlineComment) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((prev) =>
      prev && files.some((f) => f.filename === prev)
        ? prev
        : (files[0]?.filename ?? null),
    );
  }, [files]);

  const active = files.find((f) => f.filename === selected) ?? null;
  const pendingForActive = active
    ? pendingComments.filter((p) => p.path === active.filename)
    : [];

  function selectFile(filename: string) {
    setSelected(filename);
  }

  function collapse() {
    setSelected(null);
  }

  function expandAll() {
    setSelected(files[0]?.filename ?? null);
  }

  return (
    <section className="border-border bg-surface-container-lowest shadow-card overflow-hidden rounded-xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-headline text-title-md text-on-surface font-semibold">
            Changed files ({files.length})
          </h2>
          <p className="font-keycap text-body-sm text-on-surface-variant mt-0.5 tabular-nums">
            <span className="text-success">+{totals.add}</span>{" "}
            <span className="text-error">−{totals.del}</span>
          </p>
        </div>
        {files.length > 0 ? (
          <div className="text-body-sm flex gap-2">
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface underline underline-offset-2"
              onClick={expandAll}
            >
              Expand all
            </button>
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface underline underline-offset-2"
              onClick={collapse}
            >
              Collapse
            </button>
          </div>
        ) : null}
      </div>

      {files.length === 0 ? (
        <p className="text-body-md text-on-surface-variant px-4 py-12 text-center">
          No changed files loaded.
        </p>
      ) : (
        <div className="grid lg:grid-cols-12">
          <nav
            aria-label="Changed files"
            className="border-border border-b lg:col-span-4 lg:max-h-[min(36rem,70vh)] lg:overflow-y-auto lg:border-r lg:border-b-0"
          >
            <ul>
              {files.map((f) => {
                const isActive = selected === f.filename;
                const pendingCount = pendingComments.filter(
                  (p) => p.path === f.filename,
                ).length;
                return (
                  <li
                    key={f.filename}
                    className="border-border/70 border-b last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => selectFile(f.filename)}
                      aria-current={isActive ? "true" : undefined}
                      aria-expanded={isActive}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-stream-github/60 ring-primary-container/40 ring-1 ring-inset"
                          : "hover:bg-surface-container-low",
                      )}
                    >
                      <span
                        className={cn(
                          "font-keycap mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold",
                          f.status === "added" &&
                            "bg-success-container text-on-success-container",
                          f.status === "removed" &&
                            "bg-error-container text-on-error-container",
                          f.status === "modified" &&
                            "bg-stream-github text-stream-github-fg",
                          f.status === "renamed" &&
                            "bg-warning-container text-on-warning-container",
                          !["added", "removed", "modified", "renamed"].includes(
                            f.status,
                          ) &&
                            "bg-surface-container-high text-on-surface-variant",
                        )}
                        aria-hidden
                      >
                        {statusLetter(f.status)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-keycap text-body-sm text-on-surface truncate">
                          {f.filename}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={statusBadgeVariant(f.status)}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {statusLabel(f.status)}
                          </Badge>
                          {!f.patch ? (
                            <span className="text-on-surface-variant text-[10px]">
                              no patch
                            </span>
                          ) : null}
                          {pendingCount > 0 ? (
                            <Badge
                              variant="warning"
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {pendingCount} pending
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="font-keycap text-body-sm shrink-0 tabular-nums">
                        <span className="text-success">+{f.additions}</span>{" "}
                        <span className="text-error">−{f.deletions}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="lg:col-span-8">
            {active ? (
              <>
                <div className="border-border bg-surface-container-low/50 flex flex-wrap items-center gap-2 border-b px-3 py-2">
                  <FileCode2
                    className="text-on-surface-variant h-3.5 w-3.5"
                    aria-hidden
                  />
                  <span className="font-keycap text-body-sm text-on-surface">
                    {active.filename}
                  </span>
                  <Badge variant={statusBadgeVariant(active.status)}>
                    {statusLabel(active.status)}
                  </Badge>
                  <span className="font-keycap text-body-sm ml-auto tabular-nums">
                    <span className="text-success">+{active.additions}</span>{" "}
                    <span className="text-error">−{active.deletions}</span>
                  </span>
                </div>
                <FileDiff
                  file={active}
                  pendingForFile={pendingForActive}
                  onAddPending={onAddPending}
                />
              </>
            ) : (
              <Card
                padding="default"
                variant="ghost"
                className="border-border m-4 border border-dashed"
              >
                <p className="text-body-md text-on-surface-variant text-center">
                  Select a file to review the diff.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
