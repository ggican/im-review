import { ChevronDown, ChevronRight, FileCode2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { ChangedFile } from "@/features/ai-review/generate";
import { cn } from "@/lib/cn";

type DiffLineKind = "hunk" | "add" | "del" | "ctx" | "meta";

type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
};

function parsePatch(patch: string): DiffLine[] {
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
    // context (space-prefixed) or bare
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

function FileDiff({ file, open }: { file: ChangedFile; open: boolean }) {
  const lines = useMemo(
    () => (file.patch ? parsePatch(file.patch) : []),
    [file.patch],
  );

  if (!open) return null;

  if (!file.patch) {
    return (
      <p className="border-t border-neutral-200 px-3 py-4 text-xs text-neutral-500 dark:border-neutral-800">
        No patch available (binary file, or diff too large for the GitHub API).
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-auto border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40">
      <table className="w-full min-w-[40rem] border-collapse font-mono text-xs leading-5">
        <tbody>
          {lines.map((line, i) => (
            <tr
              key={`${i}-${line.kind}-${line.oldLine}-${line.newLine}`}
              className={cn(
                line.kind === "add" &&
                  "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
                line.kind === "del" &&
                  "bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100",
                line.kind === "hunk" &&
                  "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
                line.kind === "meta" && "text-neutral-400 italic",
              )}
            >
              <td className="w-10 px-2 text-right text-neutral-400 tabular-nums select-none">
                {line.oldLine ?? ""}
              </td>
              <td className="w-10 px-2 text-right text-neutral-400 tabular-nums select-none">
                {line.newLine ?? ""}
              </td>
              <td
                className={cn(
                  "w-4 px-1 text-center font-semibold select-none",
                  line.kind === "add" && "text-emerald-600",
                  line.kind === "del" && "text-red-600",
                )}
              >
                {line.kind === "add" ? "+" : line.kind === "del" ? "−" : ""}
              </td>
              <td className="px-2 py-0.5 break-all whitespace-pre-wrap">
                {line.kind === "hunk" ? line.text : line.text || " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChangedFilesPanel({
  files,
  totals,
}: {
  files: ChangedFile[];
  totals: { add: number; del: number };
}) {
  const [openFiles, setOpenFiles] = useState<Set<string>>(() => new Set());

  function toggle(filename: string) {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }

  function expandAll() {
    setOpenFiles(new Set(files.map((f) => f.filename)));
  }

  function collapseAll() {
    setOpenFiles(new Set());
  }

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Changed files ({files.length})
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs tabular-nums">
            <span className="text-emerald-600">+{totals.add}</span>{" "}
            <span className="text-red-600">−{totals.del}</span>
          </p>
          {files.length > 0 ? (
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={expandAll}
              >
                Expand all
              </button>
              <button
                type="button"
                className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
                onClick={collapseAll}
              >
                Collapse
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {files.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          No changed files loaded.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          {files.map((f) => {
            const open = openFiles.has(f.filename);
            return (
              <li
                key={f.filename}
                className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
              >
                <button
                  type="button"
                  onClick={() => toggle(f.filename)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  )}
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-neutral-900 dark:text-neutral-100">
                      {f.filename}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {statusLabel(f.status)}
                      {!f.patch ? " · no patch" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs tabular-nums">
                    <span className="text-emerald-600">+{f.additions}</span>{" "}
                    <span className="text-red-600">−{f.deletions}</span>
                  </div>
                </button>
                <FileDiff file={f} open={open} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
