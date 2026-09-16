import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewEvent } from "@/features/pr/types";

import type { AiFinding, AiReviewDraft, AiSeverity } from "./types";

const EVENTS: { id: ReviewEvent; label: string }[] = [
  { id: "COMMENT", label: "Comment" },
  { id: "REQUEST_CHANGES", label: "Request changes" },
  { id: "APPROVE", label: "Approve" },
];

function severityVariant(s: AiSeverity): "error" | "warning" | "default" {
  switch (s) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    default:
      return "default";
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
      <div className="border-stream-ai-border bg-stream-ai/40 space-y-3 rounded-lg border p-4">
        <div className="text-body-sm text-stream-ai-fg flex items-center gap-2 font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cursor AI is reviewing… {clock}
        </div>
        <p className="text-body-sm text-stream-ai-fg/80">
          Cursor SDK reviews pasted GitHub patches — no cloud VM clone (needs
          Node.js 22.13+). Usually much faster than Cloud Agents. Nothing is
          posted until you confirm.
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
    <div className="border-stream-ai-border bg-stream-ai/30 space-y-3 rounded-lg border p-4">
      <div className="text-body-sm text-on-surface flex items-center gap-2 font-medium">
        <Sparkles className="text-stream-ai-fg h-4 w-4" />
        AI review draft
      </div>

      <div className="space-y-1">
        <label
          htmlFor="ai-draft-summary"
          className="text-label-sm text-on-surface-variant font-medium tracking-wide uppercase"
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
        <div className="text-label-sm text-on-surface-variant font-medium tracking-wide uppercase">
          Findings ({included}/{draft.findings.length} selected)
        </div>
        {draft.findings.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            No findings returned.
          </p>
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
        <div className="text-label-sm text-on-surface-variant font-medium tracking-wide uppercase">
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
    <li className="border-border bg-surface-container-lowest flex gap-2 rounded-md border p-2">
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
          <Badge
            variant={severityVariant(finding.severity)}
            className="uppercase"
          >
            {finding.severity}
          </Badge>
          <span className="text-body-sm text-on-surface font-medium">
            {finding.title}
          </span>
        </div>
        {finding.path ? (
          <div className="text-on-surface-variant mt-0.5 font-mono text-xs">
            {finding.path}
            {finding.line != null ? `:${finding.line}` : ""}
          </div>
        ) : null}
        <p className="text-body-sm text-on-surface-variant mt-1 whitespace-pre-wrap">
          {finding.body}
        </p>
      </div>
    </li>
  );
}
