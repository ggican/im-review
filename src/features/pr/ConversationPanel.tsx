import { Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentTemplate } from "@/lib/settings";
import { relativeTime } from "@/lib/time";

import { postIssueComment } from "./api";
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
};

export function ConversationPanel({
  pr,
  comments,
  loading,
  error,
  templates,
  writeDisabled = false,
  onPosted,
}: Props) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

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

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-neutral-400" />
        <h2 className="text-sm font-semibold">Conversation</h2>
        <span className="text-xs text-neutral-400">
          ({comments.length} comment{comments.length === 1 ? "" : "s"})
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        Issue-level comments on this PR (same as the Conversation tab on
        GitHub).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading comments…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && !error && comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-500">
          No conversation comments yet.
        </p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full"
                  />
                ) : null}
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {c.user}
                </span>
                <span aria-hidden>·</span>
                <span>{relativeTime(c.createdAt)}</span>
                <a
                  href={c.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto underline underline-offset-2"
                >
                  GitHub
                </a>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        {templates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={posting || writeDisabled}
                onClick={() => setBody(t.body)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Writes paused after a GitHub rate limit — wait a few minutes.
          </p>
        ) : null}
      </div>
    </section>
  );
}
