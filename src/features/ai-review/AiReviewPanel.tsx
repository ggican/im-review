import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewEvent } from "@/features/pr/types";
import { cn } from "@/lib/cn";

import type { AiFinding, AiReviewDraft, AiSeverity } from "./types";

const EVENTS: { id: ReviewEvent; label: string }[] = [
  { id: "COMMENT", label: "Comment" },
  { id: "REQUEST_CHANGES", label: "Request changes" },
  { id: "APPROVE", label: "Approve" },
];

function severityClass(s: AiSeverity): string {
  switch (s) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "warning":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";
  }
}

type Props = {
  generating: boolean;
  posting: boolean;
  draft: AiReviewDraft | null;
  onSummaryChange: (summary: string) => void;
  onToggleFinding: (id: string) => void;
  onEventChange: (event: ReviewEvent) => void;
  onCancel: () => void;
  onPost: () => void;
};

export function AiReviewPanel({
  generating,
  posting,
  draft,
  onSummaryChange,
  onToggleFinding,
  onEventChange,
  onCancel,
  onPost,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!generating) {
      setElapsedSec(0);
      return;
    }
    setElapsedSec(0);
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [generating]);

  if (generating) {
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const clock = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    return (
      <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-900 dark:text-violet-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cursor AI is reviewing… {clock}
        </div>
        <p className="text-xs text-violet-800/80 dark:text-violet-300/80">
          Local Cursor SDK reviews pasted GitHub patches — no cloud VM clone.
          Usually much faster than Cloud Agents. Nothing is posted until you
          confirm.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel waiting
        </Button>
      </div>
    );
  }

  if (!draft) return null;

  const included = draft.findings.filter((f) => f.included).length;

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        AI review draft
      </div>

      <div className="space-y-1">
        <label
          htmlFor="ai-draft-summary"
          className="text-xs font-medium tracking-wide text-neutral-400 uppercase"
        >
          Summary
        </label>
        <Textarea
          id="ai-draft-summary"
          rows={3}
          value={draft.summary}
          onChange={(e) => onSummaryChange(e.currentTarget.value)}
          disabled={posting}
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
          Findings ({included}/{draft.findings.length} selected)
        </div>
        {draft.findings.length === 0 ? (
          <p className="text-xs text-neutral-500">No findings returned.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {draft.findings.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                onToggle={onToggleFinding}
                disabled={posting}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
          Post as
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENTS.map((ev) => (
            <Button
              key={ev.id}
              type="button"
              size="sm"
              variant={draft.suggestedEvent === ev.id ? "default" : "outline"}
              disabled={posting}
              onClick={() => onEventChange(ev.id)}
            >
              {ev.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" onClick={onPost} disabled={posting}>
          {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Post review to GitHub
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={posting}
        >
          Discard draft
        </Button>
      </div>
    </div>
  );
}

function FindingRow({
  finding,
  onToggle,
  disabled,
}: {
  finding: AiFinding;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <li className="flex gap-2 rounded-md border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
      <input
        type="checkbox"
        className="mt-1"
        checked={finding.included}
        disabled={disabled}
        onChange={() => onToggle(finding.id)}
        aria-label={`Include ${finding.title}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium uppercase",
              severityClass(finding.severity),
            )}
          >
            {finding.severity}
          </span>
          <span className="text-xs font-medium">{finding.title}</span>
        </div>
        {finding.path ? (
          <div className="mt-0.5 font-mono text-xs text-neutral-400">
            {finding.path}
            {finding.line != null ? `:${finding.line}` : ""}
          </div>
        ) : null}
        <p className="mt-1 text-xs whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
          {finding.body}
        </p>
      </div>
    </li>
  );
}
