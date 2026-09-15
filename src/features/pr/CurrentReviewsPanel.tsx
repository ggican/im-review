import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

import {
  deleteReviewComment,
  dismissReview,
  replyToReviewComment,
  threadReviewComments,
  updateReviewComment,
} from "./api";
import { rateLimitUserMessage } from "./rate-limit";
import type {
  PrReviewComment,
  PrReviewItem,
  PrReviewsSnapshot,
  PullRequest,
} from "./types";

type Props = {
  pr: Pick<PullRequest, "repo" | "number">;
  snapshot: PrReviewsSnapshot | null;
  loading: boolean;
  error: string | null;
  writeDisabled?: boolean;
  onRefresh: () => void;
  onMutated: () => void;
};

function stateLabel(state: string): string {
  switch (state) {
    case "APPROVED":
      return "Approved";
    case "CHANGES_REQUESTED":
      return "Changes requested";
    case "COMMENTED":
      return "Commented";
    case "DISMISSED":
      return "Dismissed";
    case "PENDING":
      return "Pending";
    default:
      return state;
  }
}

function stateBadgeVariant(
  state: string,
): "success" | "error" | "secondary" | "warning" | "outline" | "default" {
  switch (state) {
    case "APPROVED":
      return "success";
    case "CHANGES_REQUESTED":
      return "error";
    case "COMMENTED":
      return "secondary";
    case "DISMISSED":
      return "outline";
    case "PENDING":
      return "warning";
    default:
      return "default";
  }
}

function overallStatus(latest: PrReviewsSnapshot["latestByUser"]): {
  label: string;
  state: string;
} {
  if (latest.length === 0) {
    return { label: "No review", state: "NONE" };
  }
  if (latest.some((u) => u.state === "CHANGES_REQUESTED")) {
    return { label: "Changes requested", state: "CHANGES_REQUESTED" };
  }
  if (latest.some((u) => u.state === "APPROVED")) {
    return { label: "Approved", state: "APPROVED" };
  }
  if (latest.some((u) => u.state === "PENDING")) {
    return { label: "Pending", state: "PENDING" };
  }
  if (latest.some((u) => u.state === "COMMENTED")) {
    return { label: "Commented", state: "COMMENTED" };
  }
  if (latest.every((u) => u.state === "DISMISSED")) {
    return { label: "Dismissed", state: "DISMISSED" };
  }
  return { label: "No review", state: "NONE" };
}

function countByState(
  latest: PrReviewsSnapshot["latestByUser"],
  state: string,
): number {
  return latest.filter((u) => u.state === state).length;
}

function ReviewStateBadge({
  state,
  className,
}: {
  state: string;
  className?: string;
}) {
  return (
    <Badge variant={stateBadgeVariant(state)} className={className}>
      {state === "APPROVED" ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : null}
      {state === "CHANGES_REQUESTED" ? (
        <XCircle className="h-3 w-3" aria-hidden />
      ) : null}
      {stateLabel(state)}
    </Badge>
  );
}

function InlineCommentBlock({
  comment,
  indent,
  writeDisabled,
  pr,
  replyToId,
  onStartReply,
  onCancelReply,
  onMutated,
}: {
  comment: PrReviewComment;
  indent?: boolean;
  writeDisabled: boolean;
  pr: Pick<PullRequest, "repo" | "number">;
  replyToId: number | null;
  onStartReply: (id: number) => void;
  onCancelReply: () => void;
  onMutated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const replying = replyToId === comment.id;

  async function saveEdit() {
    if (writeDisabled || busy) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await updateReviewComment(pr, comment.id, trimmed);
      setEditing(false);
      toast.success("Comment updated");
      onMutated();
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (writeDisabled || busy) return;
    if (!window.confirm("Delete this review comment?")) return;
    setBusy(true);
    try {
      await deleteReviewComment(pr, comment.id);
      toast.success("Comment deleted");
      onMutated();
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (writeDisabled || busy) return;
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await replyToReviewComment(pr, comment.id, trimmed);
      setReplyBody("");
      onCancelReply();
      toast.success("Reply posted");
      onMutated();
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-surface-container-lowest p-3",
        indent && "ml-4 border-l-2 border-l-primary-container/50",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-keycap text-on-surface-variant">
        <span className="truncate font-mono text-xs">{comment.path}</span>
        {comment.line != null ? (
          <span className="font-mono text-xs">:{comment.line}</span>
        ) : null}
        <span className="font-sans text-body-sm text-on-surface-variant">
          · {comment.user}
        </span>
        <span className="font-sans text-body-sm">
          {relativeTime(comment.createdAt)}
        </span>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || writeDisabled}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || writeDisabled || !draft.trim()}
              onClick={() => void saveEdit()}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setDraft(comment.body);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="text-body-sm leading-relaxed whitespace-pre-wrap text-on-surface">
          {comment.body || "(empty comment)"}
        </pre>
      )}
      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={writeDisabled || busy}
            onClick={() =>
              replying ? onCancelReply() : onStartReply(comment.id)
            }
          >
            Reply
          </Button>
          {comment.isOwn ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={writeDisabled || busy}
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={writeDisabled || busy}
                onClick={() => void onDelete()}
              >
                Delete
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void openUrl(comment.htmlUrl)}
          >
            GitHub
          </Button>
        </div>
      ) : null}
      {replying ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          <Textarea
            rows={2}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            disabled={busy || writeDisabled}
            placeholder="Write a reply…"
            aria-label="Reply body"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || writeDisabled || !replyBody.trim()}
              onClick={() => void sendReply()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Post reply
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onCancelReply}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ReviewCard({
  review,
  pr,
  writeDisabled,
  onMutated,
}: {
  review: PrReviewItem;
  pr: Pick<PullRequest, "repo" | "number">;
  writeDisabled: boolean;
  onMutated: () => void;
}) {
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissMsg, setDismissMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const threads = threadReviewComments(review.comments);

  async function onDismiss() {
    if (writeDisabled || busy) return;
    const trimmed = dismissMsg.trim();
    if (!trimmed) {
      toast.error("Dismiss message is required");
      return;
    }
    setBusy(true);
    try {
      await dismissReview(pr, review.id, trimmed);
      setDismissOpen(false);
      setDismissMsg("");
      toast.success("Review dismissed");
      onMutated();
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-3 border-b border-border px-4 py-3 last:border-b-0">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {review.avatarUrl ? (
            <img
              src={review.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full border border-border"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high font-keycap text-on-surface-variant"
              aria-hidden
            >
              {(review.user.slice(0, 2) || "?").toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body-md font-medium text-on-surface">
                {review.user}
              </span>
              <ReviewStateBadge state={review.state} />
            </div>
            <p className="text-body-sm text-on-surface-variant">
              {review.submittedAt
                ? relativeTime(review.submittedAt)
                : "Unknown time"}
              {review.comments.length > 0
                ? ` · ${review.comments.length} inline`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {review.state !== "DISMISSED" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={writeDisabled || busy}
              onClick={() => setDismissOpen((v) => !v)}
            >
              Dismiss
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void openUrl(review.htmlUrl)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        </div>
      </header>

      {dismissOpen ? (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning-container/80 p-3">
          <Input
            value={dismissMsg}
            onChange={(e) => setDismissMsg(e.target.value)}
            placeholder="Reason for dismissing (required)"
            aria-label="Dismiss message"
            disabled={busy || writeDisabled}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || writeDisabled || !dismissMsg.trim()}
              onClick={() => void onDismiss()}
            >
              Confirm dismiss
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setDismissOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {review.body ? (
        <pre className="rounded-lg border border-border bg-surface-container-low/60 p-3 text-body-sm leading-relaxed whitespace-pre-wrap text-on-surface">
          {review.body}
        </pre>
      ) : (
        <p className="text-body-sm text-on-surface-variant italic">
          No review summary body.
        </p>
      )}

      {threads.length > 0 ? (
        <ul className="space-y-2">
          {threads.map(({ root, replies }) => (
            <div key={root.id} className="space-y-2">
              <InlineCommentBlock
                comment={root}
                pr={pr}
                writeDisabled={writeDisabled}
                replyToId={replyToId}
                onStartReply={setReplyToId}
                onCancelReply={() => setReplyToId(null)}
                onMutated={onMutated}
              />
              {replies.map((r) => (
                <InlineCommentBlock
                  key={r.id}
                  comment={r}
                  indent
                  pr={pr}
                  writeDisabled={writeDisabled}
                  replyToId={replyToId}
                  onStartReply={setReplyToId}
                  onCancelReply={() => setReplyToId(null)}
                  onMutated={onMutated}
                />
              ))}
            </div>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function CurrentReviewsPanel({
  pr,
  snapshot,
  loading,
  error,
  writeDisabled = false,
  onRefresh,
  onMutated,
}: Props) {
  const summary = useMemo(() => {
    if (!snapshot) return null;
    const latest = snapshot.latestByUser;
    return {
      overall: overallStatus(latest),
      approved: countByState(latest, "APPROVED"),
      changes: countByState(latest, "CHANGES_REQUESTED"),
      commented: countByState(latest, "COMMENTED"),
      dismissed: countByState(latest, "DISMISSED"),
      pending: countByState(latest, "PENDING"),
    };
  }, [snapshot]);

  return (
    <section className="space-y-4">
      <Card padding="default">
        <CardHeader className="mb-3 flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-title-md font-semibold">
              <MessageSquareText
                className="h-4 w-4 text-on-surface-variant"
                aria-hidden
              />
              Reviews
            </CardTitle>
            <CardDescription>
              GitHub review activity for this PR — status, timeline, and inline
              threads.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={onRefresh}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-warning/30 bg-warning-container px-3 py-2 text-body-sm text-on-warning-container"
            >
              {error}
            </div>
          ) : null}

          {loading && !snapshot ? (
            <div className="flex items-center gap-2 py-8 text-body-md text-on-surface-variant">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading reviews from GitHub…
            </div>
          ) : null}

          {snapshot && summary ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                  Current status
                </span>
                {summary.overall.state === "NONE" ? (
                  <Badge variant="outline">No review</Badge>
                ) : (
                  <ReviewStateBadge state={summary.overall.state} />
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Approved
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-success tabular-nums">
                    {summary.approved}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Changes requested
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-error tabular-nums">
                    {summary.changes}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface-container-low/50 px-3 py-2">
                  <p className="text-label-sm text-on-surface-variant uppercase">
                    Comments
                  </p>
                  <p className="mt-0.5 font-headline text-headline-sm text-on-surface tabular-nums">
                    {summary.commented}
                    <span className="ml-1 text-body-sm font-normal text-on-surface-variant">
                      · {snapshot.inlineCount} inline
                    </span>
                  </p>
                </div>
              </div>

              {snapshot.latestByUser.length > 0 ? (
                <div>
                  <p className="mb-2 text-label-sm tracking-wide text-on-surface-variant uppercase">
                    Reviewers
                  </p>
                  <ul className="space-y-1.5">
                    {snapshot.latestByUser.map((u) => (
                      <li
                        key={u.user}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-container-lowest px-2.5 py-1.5"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt=""
                              className="h-6 w-6 rounded-full border border-border"
                            />
                          ) : (
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-high font-keycap text-on-surface-variant"
                              aria-hidden
                            >
                              {(u.user.slice(0, 2) || "?").toUpperCase()}
                            </span>
                          )}
                          <span className="truncate text-body-sm font-medium text-on-surface">
                            {u.user}
                          </span>
                        </span>
                        <ReviewStateBadge state={u.state} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="font-keycap text-body-sm text-on-surface-variant">
                {snapshot.reviews.length} review submission
                {snapshot.reviews.length === 1 ? "" : "s"}
                {summary.dismissed > 0
                  ? ` · ${summary.dismissed} dismissed`
                  : ""}
                {summary.pending > 0 ? ` · ${summary.pending} pending` : ""}
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      {snapshot ? (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-headline text-title-md font-semibold text-on-surface">
              Timeline
            </h3>
            <p className="mt-0.5 text-body-sm text-on-surface-variant">
              Newest submissions first. Reply, edit, or dismiss from each row.
            </p>
          </div>
          {snapshot.reviews.length === 0 ? (
            <p className="px-4 py-10 text-center text-body-md text-on-surface-variant">
              No reviews yet on this PR.
            </p>
          ) : (
            <div>
              {snapshot.reviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  pr={pr}
                  writeDisabled={writeDisabled}
                  onMutated={onMutated}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </section>
  );
}
