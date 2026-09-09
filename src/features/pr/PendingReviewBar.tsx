import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { PendingInlineComment, ReviewEvent } from "./types";

type Props = {
  pending: PendingInlineComment[];
  event: ReviewEvent;
  body: string;
  isDraft: boolean;
  submitting: boolean;
  onEventChange: (event: ReviewEvent) => void;
  onBodyChange: (body: string) => void;
  onRemove: (id: string) => void;
  onSubmit: () => void;
};

export function PendingReviewBar({
  pending,
  event,
  body,
  isDraft,
  submitting,
  onEventChange,
  onBodyChange,
  onRemove,
  onSubmit,
}: Props) {
  if (pending.length === 0) return null;

  const needsBodyOrComments =
    event === "COMMENT" || event === "REQUEST_CHANGES";
  const canSubmit =
    !submitting &&
    !(isDraft && event === "APPROVE") &&
    (!needsBodyOrComments || Boolean(body.trim()) || pending.length > 0);

  return (
    <div className="sticky bottom-0 z-20 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg dark:border-amber-800 dark:bg-amber-950/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Pending review ({pending.length})
          </h3>
          <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
            You can approve and still leave line comments (same as GitHub).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs dark:border-amber-700 dark:bg-neutral-950"
            value={event}
            disabled={submitting}
            onChange={(e) =>
              onEventChange(e.currentTarget.value as ReviewEvent)
            }
            aria-label="Review event"
          >
            <option value="COMMENT">Comment</option>
            <option value="APPROVE">Approve</option>{" "}
            <option value="REQUEST_CHANGES">Request changes</option>
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Submit review
          </Button>
        </div>
      </div>

      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
        {pending.map((p) => (
          <li
            key={p.id}
            className="flex items-start justify-between gap-2 rounded bg-white/70 px-2 py-1 dark:bg-neutral-950/50"
          >
            <span className="min-w-0">
              <span className="font-mono text-neutral-500">
                {p.path}:{p.line}
              </span>{" "}
              {p.body.length > 80 ? `${p.body.slice(0, 80)}…` : p.body}
            </span>
            <button
              type="button"
              className="shrink-0 text-neutral-500 underline"
              disabled={submitting}
              onClick={() => onRemove(p.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <Textarea
        rows={2}
        value={body}
        onChange={(e) => onBodyChange(e.currentTarget.value)}
        disabled={submitting}
        placeholder="Optional summary for the review…"
      />
      {isDraft && event === "APPROVE" ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Draft PRs cannot be approved until marked ready.
        </p>
      ) : null}
    </div>
  );
}
