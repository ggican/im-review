import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    default:
      return state;
  }
}

function stateClass(state: string): string {
  switch (state) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "CHANGES_REQUESTED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "COMMENTED":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
    case "DISMISSED":
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
    default:
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";
  }
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
        "rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950",
        indent && "ml-4 border-l-2 border-l-sky-300 dark:border-l-sky-800",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-neutral-500">
        <span className="truncate">{comment.path}</span>
        {comment.line != null ? <span>:{comment.line}</span> : null}
        <span className="font-sans text-neutral-400">· {comment.user}</span>
        <span className="font-sans">{relativeTime(comment.createdAt)}</span>
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
        <pre className="text-xs leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
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
        <div className="mt-2 space-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
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
    <article className="space-y-3 border-b border-neutral-200 px-4 py-4 last:border-b-0 dark:border-neutral-800">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {review.avatarUrl ? (
            <img
              src={review.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full border border-neutral-200 dark:border-neutral-800"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{review.user}</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase",
                  stateClass(review.state),
                )}
              >
                {stateLabel(review.state)}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
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
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
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
        <pre className="rounded-md bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
          {review.body}
        </pre>
      ) : (
        <p className="text-xs text-neutral-400 italic">
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
  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquareText className="h-4 w-4 text-neutral-600" />
            Current reviews
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Who already reviewed this PR on GitHub, including their summary and
            inline comments. Reply, edit, or dismiss from here.
          </p>
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
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reviews from GitHub…
        </div>
      ) : null}

      {snapshot ? (
        <>
          {snapshot.latestByUser.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.latestByUser.map((u) => (
                <div
                  key={u.user}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 py-1 pr-2.5 pl-1 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="text-xs font-medium">{u.user}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase",
                      stateClass(u.state),
                    )}
                  >
                    {stateLabel(u.state)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-neutral-500">
            {snapshot.reviews.length} review submission
            {snapshot.reviews.length === 1 ? "" : "s"} · {snapshot.inlineCount}{" "}
            inline comment{snapshot.inlineCount === 1 ? "" : "s"}
          </p>

          {snapshot.reviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              No reviews yet on this PR.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
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
        </>
      ) : null}
    </section>
  );
}
