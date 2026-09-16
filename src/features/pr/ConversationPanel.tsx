import { Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { CommentTemplate } from "@/lib/settings";
import { relativeTime } from "@/lib/time";

import {
  deleteIssueComment,
  postIssueComment,
  updateIssueComment,
} from "./api";
import { rateLimitUserMessage } from "./rate-limit";
import type { IssueComment, PullRequest } from "./types";

type Props = {
  pr: Pick<PullRequest, "repo" | "number">;
  comments: IssueComment[];
  loading: boolean;
  error: string | null;
  templates: CommentTemplate[];
  writeDisabled?: boolean;
  onPosted: (comment: IssueComment) => void;
  onUpdated: (comment: IssueComment) => void;
  onDeleted: (commentId: number) => void;
};

export function ConversationPanel({
  pr,
  comments,
  loading,
  error,
  templates,
  writeDisabled = false,
  onPosted,
  onUpdated,
  onDeleted,
}: Props) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [rowBusy, setRowBusy] = useState(false);

  async function onSubmit() {
    if (writeDisabled || posting) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const created = await postIssueComment(pr, trimmed);
      onPosted(created);
      setBody("");
      toast.success("Comment posted");
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setPosting(false);
    }
  }

  async function saveEdit(id: number) {
    if (writeDisabled || rowBusy) return;
    const trimmed = editBody.trim();
    if (!trimmed) return;
    setRowBusy(true);
    try {
      const updated = await updateIssueComment(pr, id, trimmed);
      onUpdated(updated);
      setEditingId(null);
      toast.success("Comment updated");
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setRowBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (writeDisabled || rowBusy) return;
    if (!window.confirm("Delete this comment?")) return;
    setRowBusy(true);
    try {
      await deleteIssueComment(pr, id);
      onDeleted(id);
      toast.success("Comment deleted");
    } catch (err) {
      toast.error(rateLimitUserMessage(err));
    } finally {
      setRowBusy(false);
    }
  }

  return (
    <Card padding="default" className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare
          className="text-on-surface-variant h-4 w-4"
          aria-hidden
        />
        <h2 className="font-headline text-title-md text-on-surface font-semibold">
          Conversation
        </h2>
        <span className="text-body-sm text-on-surface-variant">
          ({comments.length} comment{comments.length === 1 ? "" : "s"})
        </span>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Issue-level comments on this PR (same as the Conversation tab on
        GitHub).
      </p>

      {loading ? (
        <div className="text-body-md text-on-surface-variant flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading comments…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-warning/30 bg-warning-container text-body-sm text-on-warning-container rounded-lg border px-3 py-2"
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && comments.length === 0 ? (
        <p className="text-body-md text-on-surface-variant py-4 text-center">
          No conversation comments yet.
        </p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="border-border bg-surface-container-low/40 rounded-lg border px-3 py-2.5"
            >
              <div className="text-body-sm text-on-surface-variant flex flex-wrap items-center gap-2">
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full"
                  />
                ) : null}
                <span className="text-on-surface font-medium">{c.user}</span>
                <span aria-hidden>·</span>
                <span>{relativeTime(c.createdAt)}</span>
                <a
                  href={c.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-on-surface ml-auto underline underline-offset-2"
                >
                  GitHub
                </a>
              </div>
              {editingId === c.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    disabled={rowBusy || writeDisabled}
                    aria-label="Edit comment"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={rowBusy || writeDisabled || !editBody.trim()}
                      onClick={() => void saveEdit(c.id)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={rowBusy}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-body-md text-on-surface mt-2 whitespace-pre-wrap">
                    {c.body}
                  </p>
                  {c.isOwn ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={writeDisabled || rowBusy}
                        onClick={() => {
                          setEditingId(c.id);
                          setEditBody(c.body);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={writeDisabled || rowBusy}
                        onClick={() => void onDelete(c.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-border space-y-2 border-t pt-3">
        {templates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={posting || writeDisabled}
                onClick={() => setBody(t.body)}
                className="border-border bg-surface-container-lowest text-on-surface hover:bg-surface-container-low rounded-md border px-2 py-1 text-xs font-medium"
                title={t.body}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : null}
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          disabled={posting || writeDisabled}
          placeholder="Leave a comment on this PR…"
        />
        <Button
          type="button"
          size="sm"
          disabled={posting || writeDisabled || !body.trim()}
          onClick={() => void onSubmit()}
        >
          {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Comment
        </Button>
        {writeDisabled ? (
          <p className="text-body-sm text-warning">
            Writes paused after a GitHub rate limit — wait a few minutes.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
