import { CheckCircle2, Circle, Loader2, Sparkles, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewEvent } from "@/features/pr/types";
import { cn } from "@/lib/cn";

import type { AiFinding, AiReviewDraft, AiSeverity } from "./types";

export const AI_REVIEW_EVENTS: { id: ReviewEvent; label: string }[] = [
  { id: "COMMENT", label: "Comment" },
  { id: "REQUEST_CHANGES", label: "Request changes" },
  { id: "APPROVE", label: "Approve" },
];

export const AI_REFINE_CHIPS = [
  {
    id: "two",
    label: "Only 2 findings",
    instruction:
      "Keep only the 2 most important findings. Drop the rest. Keep summary short.",
  },
  {
    id: "en",
    label: "English",
    instruction:
      "Rewrite the summary and all findings in clear professional English.",
  },
  {
    id: "simple",
    label: "Simpler language",
    instruction:
      "Rewrite the summary and all findings in simpler, easier-to-read language. Avoid jargon where possible.",
  },
] as const;

type AiTabPhase = "ready" | "ai_running" | "draft";

type ProgressLog = {
  step: string;
  message: string;
  detail?: string | null;
};

type Props = {
  phase: AiTabPhase;
  draft: AiReviewDraft | null;
  logs: ProgressLog[];
  hasAiKey: boolean;
  aiProviderLabel: string;
  filesCount: number;
  confirmed: boolean;
  posting: boolean;
  refining: boolean;
  refineText: string;
  runError: string | null;
  pendingInlineCount: number;
  onConfirmedChange: (checked: boolean) => void;
  onRefineTextChange: (value: string) => void;
  onSummaryChange: (summary: string) => void;
  onToggleFinding: (id: string) => void;
  onIgnoreFinding: (id: string) => void;
  onEventChange: (event: ReviewEvent) => void;
  onRun: () => void;
  onRefine: (instruction: string) => void;
  onSubmit: () => void;
  onDiscard: () => void;
};

function severityLabel(s: AiSeverity): string {
  switch (s) {
    case "critical":
      return "Critical";
    case "warning":
      return "Medium";
    default:
      return "Informational";
  }
}

function severityBadgeVariant(
  s: AiSeverity,
): "error" | "warning" | "secondary" {
  switch (s) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    default:
      return "secondary";
  }
}

function reviewStatus(props: {
  phase: AiTabPhase;
  draft: AiReviewDraft | null;
  runError: string | null;
}): {
  label: string;
  detail: string;
  tone: "neutral" | "ai" | "success" | "error" | "warning";
} {
  if (props.phase === "ai_running") {
    return {
      label: "Running",
      detail: "AI is drafting findings from the PR patches.",
      tone: "ai",
    };
  }
  if (props.phase === "draft" && props.draft) {
    if (props.draft.findings.length === 0) {
      return {
        label: "No findings",
        detail: "The draft has no findings. You can refine or re-run.",
        tone: "neutral",
      };
    }
    return {
      label: "Findings available",
      detail: "Review each finding before anything is posted to GitHub.",
      tone: "success",
    };
  }
  if (props.runError) {
    return {
      label: "Failed",
      detail: props.runError,
      tone: "error",
    };
  }
  return {
    label: "Not run",
    detail: "Run AI review to draft findings. Nothing posts automatically.",
    tone: "neutral",
  };
}

function statusBadgeVariant(
  tone: ReturnType<typeof reviewStatus>["tone"],
): "outline" | "ai" | "success" | "error" | "warning" {
  switch (tone) {
    case "ai":
      return "ai";
    case "success":
      return "success";
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "outline";
  }
}

export function AiReviewTab({
  phase,
  draft,
  logs,
  hasAiKey,
  aiProviderLabel,
  filesCount,
  confirmed,
  posting,
  refining,
  refineText,
  runError,
  pendingInlineCount,
  onConfirmedChange,
  onRefineTextChange,
  onSummaryChange,
  onToggleFinding,
  onIgnoreFinding,
  onEventChange,
  onRun,
  onRefine,
  onSubmit,
  onDiscard,
}: Props) {
  const status = reviewStatus({ phase, draft, runError });
  const selectedCount = draft
    ? draft.findings.filter((f) => f.included).length
    : 0;
  const totalFindings = draft?.findings.length ?? 0;
  const canRun = hasAiKey && filesCount > 0 && !posting && !refining;
  const submitDisabled = !confirmed || posting || refining || !draft;

  return (
    <section className="space-y-4">
      <Card padding="default" className="border-stream-ai-border/80">
        <CardHeader className="mb-3 flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-title-md flex items-center gap-2 font-semibold">
              <Sparkles
                className="h-4 w-4 text-violet-600 dark:text-violet-300"
                aria-hidden
              />
              AI review
            </CardTitle>
            <CardDescription>
              {aiProviderLabel} drafts findings from GitHub patches. You review
              and confirm — nothing is submitted automatically.
            </CardDescription>
          </div>
          {phase === "ready" ? (
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={!canRun}
              onClick={onRun}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Run AI review
            </Button>
          ) : null}
          {phase === "draft" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canRun}
              onClick={onRun}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Re-run AI
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {!hasAiKey ? (
            <p className="text-body-sm text-warning">
              {aiProviderLabel} API key missing.{" "}
              <Link to="/settings" className="underline underline-offset-2">
                Add it in Settings
              </Link>
              .
            </p>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5",
              status.tone === "ai" &&
                "border-violet-300/50 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/25",
              status.tone === "success" &&
                "border-success/30 bg-success-container/40 text-on-success-container",
              status.tone === "error" &&
                "border-error/30 bg-error-container/50 text-on-error-container",
              status.tone === "neutral" &&
                "border-border bg-surface-container-low/50",
              status.tone === "warning" &&
                "border-warning/40 bg-warning-container/50 text-on-warning-container",
            )}
          >
            <div className="mt-0.5">
              {status.tone === "ai" ? (
                <Loader2
                  className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-300"
                  aria-hidden
                />
              ) : status.tone === "success" ? (
                <CheckCircle2 className="text-success h-4 w-4" aria-hidden />
              ) : status.tone === "error" ? (
                <XCircle className="text-error h-4 w-4" aria-hidden />
              ) : (
                <Circle
                  className="text-on-surface-variant h-4 w-4"
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-sm text-on-surface-variant tracking-wide uppercase">
                  Status
                </span>
                <Badge variant={statusBadgeVariant(status.tone)}>
                  {status.label}
                </Badge>
              </div>
              <p className="text-body-sm text-on-surface">{status.detail}</p>
            </div>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3">
            <Step
              done={phase !== "ready" || Boolean(draft)}
              active={phase === "ai_running"}
              label="AI reads patches"
            />
            <Step
              done={phase === "draft"}
              active={phase === "draft"}
              label="You check findings"
            />
            <Step done={false} active={false} label="Submit after confirm" />
          </ol>

          {phase === "ai_running" ? (
            <div className="space-y-2 rounded-lg border border-violet-300/40 bg-violet-50/40 p-3 dark:border-violet-800 dark:bg-violet-950/20">
              <div className="text-body-md flex items-center gap-2 text-violet-900 dark:text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Cursor AI is reviewing patches…
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Draft only — nothing posts to GitHub until you confirm and
                submit.
              </p>
              {logs.length > 0 ? (
                <div className="border-border bg-surface-container-lowest text-on-surface-variant max-h-36 overflow-y-auto rounded-lg border p-3 font-mono text-xs">
                  {logs.map((l, i) => (
                    <div key={`${l.step}-${i}`}>
                      <span className="opacity-70">[{l.step}]</span> {l.message}
                      {l.detail ? (
                        <span className="opacity-70"> — {l.detail}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "ready" && !draft ? (
            <p className="border-border text-body-md text-on-surface-variant rounded-lg border border-dashed px-3 py-8 text-center">
              {runError
                ? "AI review failed. Fix the issue, then run again."
                : "No AI draft yet. Run AI review when you are ready to inspect findings."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {phase === "draft" && draft ? (
        <>
          <Card padding="default">
            <CardHeader className="mb-3">
              <CardTitle className="text-label-sm text-on-surface-variant tracking-wide uppercase">
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="review-draft-summary"
                aria-label="Summary"
                rows={3}
                value={draft.summary}
                onChange={(e) => onSummaryChange(e.currentTarget.value)}
                disabled={posting || refining}
              />
            </CardContent>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h3 className="font-headline text-title-md text-on-surface font-semibold">
                  Findings
                </h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  {selectedCount}/{totalFindings} selected · ignored findings
                  stay out of the submit payload
                </p>
              </div>
              <Badge variant="ai">{selectedCount} selected</Badge>
            </div>

            {draft.findings.length === 0 ? (
              <p className="text-body-md text-on-surface-variant px-4 py-10 text-center">
                No findings returned.
              </p>
            ) : (
              <ul>
                {draft.findings.map((f) => (
                  <FindingRow
                    key={f.id}
                    finding={f}
                    disabled={posting || refining}
                    onToggle={onToggleFinding}
                    onIgnore={onIgnoreFinding}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card
            padding="default"
            className="border-stream-ai-border border-dashed"
          >
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm text-on-surface-variant tracking-wide uppercase">
                Refine draft
              </CardTitle>
              <CardDescription>
                Ask {aiProviderLabel} to rewrite this draft. Still not posted
                until you submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {AI_REFINE_CHIPS.map((chip) => (
                  <Button
                    key={chip.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={posting || refining}
                    onClick={() => onRefine(chip.instruction)}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Custom: e.g. make it friendlier, focus on tests…"
                  value={refineText}
                  onChange={(e) => onRefineTextChange(e.currentTarget.value)}
                  disabled={posting || refining}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onRefine(refineText);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={posting || refining || !refineText.trim()}
                  onClick={() => onRefine(refineText)}
                >
                  {refining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Apply
                </Button>
              </div>
              {refining ? (
                <p className="text-body-sm flex items-center gap-2 text-violet-800 dark:text-violet-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Refining draft…
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card padding="default">
            <CardHeader className="mb-3">
              <CardTitle className="text-label-sm text-on-surface-variant tracking-wide uppercase">
                Human confirmation
              </CardTitle>
              <CardDescription>
                AI findings are suggestions. You must review and confirm before
                anything posts to GitHub.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {AI_REVIEW_EVENTS.map((ev) => (
                  <Button
                    key={ev.id}
                    type="button"
                    size="sm"
                    variant={
                      draft.suggestedEvent === ev.id ? "default" : "outline"
                    }
                    disabled={posting || refining}
                    onClick={() => onEventChange(ev.id)}
                  >
                    {ev.label}
                  </Button>
                ))}
              </div>

              <label className="border-border bg-surface-container-low/40 text-body-md flex items-start gap-2 rounded-lg border px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  disabled={posting || refining}
                  onChange={(e) => onConfirmedChange(e.currentTarget.checked)}
                />
                <span>
                  I reviewed these findings. Submit will post{" "}
                  <strong>inline comments</strong> on matching file/line in the
                  PR diff (plus a short summary)
                  {pendingInlineCount > 0
                    ? ` and include ${pendingInlineCount} pending Files-tab comment(s)`
                    : ""}
                  .
                </span>
              </label>

              {selectedCount === 0 ? (
                <p
                  role="status"
                  className="border-warning/30 bg-warning-container text-body-sm text-on-warning-container rounded-lg border px-3 py-2"
                >
                  No findings selected. Select at least one finding, or discard
                  and write a manual review on the Files tab.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-sm text-on-surface-variant">
                  {selectedCount} finding{selectedCount === 1 ? "" : "s"}{" "}
                  selected
                </span>
                <Button
                  type="button"
                  disabled={submitDisabled}
                  onClick={onSubmit}
                >
                  {posting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Submit review to GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={posting || refining}
                  onClick={onRun}
                >
                  Re-run AI
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={posting || refining}
                  onClick={onDiscard}
                >
                  Discard draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}

function Step({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <li
      className={cn(
        "border-border text-body-sm flex items-center gap-2 rounded-lg border px-3 py-2",
        active &&
          "border-violet-300/60 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20",
      )}
    >
      {active ? (
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-violet-600 dark:text-violet-300"
          aria-hidden
        />
      ) : done ? (
        <CheckCircle2 className="text-success h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Circle
          className="text-on-surface-variant h-4 w-4 shrink-0"
          aria-hidden
        />
      )}
      <span
        className={cn(
          active && "font-medium text-violet-900 dark:text-violet-200",
        )}
      >
        {label}
      </span>
    </li>
  );
}

function FindingRow({
  finding,
  onToggle,
  onIgnore,
  disabled,
}: {
  finding: AiFinding;
  onToggle: (id: string) => void;
  onIgnore: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <li
      className={cn(
        "border-border flex gap-3 border-b px-4 py-3 last:border-b-0",
        !finding.included && "bg-surface-container-low/40 opacity-80",
        finding.included &&
          finding.severity === "critical" &&
          "bg-error-container/20",
      )}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={finding.included}
        disabled={disabled}
        onChange={() => onToggle(finding.id)}
        aria-label={`Include ${finding.title}`}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={severityBadgeVariant(finding.severity)}
            className="uppercase"
          >
            {severityLabel(finding.severity)}
          </Badge>
          <Badge variant={finding.included ? "outline" : "secondary"}>
            {finding.included ? "Included" : "Ignored"}
          </Badge>
          <span className="text-body-md text-on-surface font-medium">
            {finding.title}
          </span>
        </div>
        {finding.path ? (
          <div className="text-on-surface-variant font-mono text-xs">
            {finding.path}
            {finding.line != null ? `:${finding.line}` : ""}
          </div>
        ) : null}
        <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap">
          {finding.body}
        </p>
        {finding.included ? (
          <div className="pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onIgnore(finding.id)}
            >
              Ignore
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
