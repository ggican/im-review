import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submitReview } from "@/features/pr/api";
import type {
  CiStatus,
  PrDetail,
  PullRequest,
  ReviewEvent,
} from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";
import { useTemplates } from "@/lib/use-settings";

import { fetchPrDetail } from "./api";

type Props = {
  pr: PullRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CiBadge({
  status,
  description,
}: {
  status: CiStatus;
  description: string;
}) {
  const color =
    status === "success"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "failure"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
        : status === "pending"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400";

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        color,
      )}
    >
      CI · {status} — {description}
    </span>
  );
}

export function PRDetailDrawer({ pr, open, onOpenChange }: Props) {
  const templates = useTemplates();
  const [detail, setDetail] = useState<PrDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<ReviewEvent | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open || !pr) {
      setDetail(null);
      setComment("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPrDetail(pr)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) toast.error(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, pr]);

  async function runReview(event: ReviewEvent) {
    if (!pr) return;
    setBusy(event);
    try {
      await submitReview(pr, event, comment);
      const label =
        event === "APPROVE"
          ? "Approved"
          : event === "REQUEST_CHANGES"
            ? "Requested changes"
            : "Commented";
      toast.success(label);
      setComment("");
      onOpenChange(false);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function openInBrowser() {
    if (!pr) return;
    try {
      await openUrl(pr.url);
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function copyLink() {
    if (!pr) return;
    try {
      await navigator.clipboard.writeText(pr.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  const shown = detail ?? pr;
  const reviewPath = pr
    ? `/review/${pr.repo.split("/")[0]}/${pr.repo.split("/")[1]}/${pr.number}`
    : "/";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" aria-describedby={undefined}>
        {shown ? (
          <>
            <DialogHeader>
              <DialogTitle className="pr-2">{shown.title}</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{shown.repo}</span>
                {" · "}
                <span className="font-mono">#{shown.number}</span>
                {" · "}
                {relativeTime(shown.updatedAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  {shown.author.avatarUrl ? (
                    <img
                      src={shown.author.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : null}
                  {shown.author.login}
                </span>
                {shown.isDraft ? (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium uppercase dark:bg-neutral-800">
                    draft
                  </span>
                ) : null}
                {detail ? (
                  <span className="font-mono">
                    <span className="text-emerald-600">
                      +{detail.additions}
                    </span>{" "}
                    <span className="text-red-600">−{detail.deletions}</span> ·{" "}
                    {detail.changedFiles} files
                  </span>
                ) : null}
              </div>

              {loading && !detail ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading details…
                </div>
              ) : null}

              {detail ? (
                <>
                  <CiBadge
                    status={detail.ciStatus}
                    description={detail.ciDescription}
                  />
                  <div>
                    <h3 className="mb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Reviewers
                    </h3>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {detail.reviewers.length
                        ? detail.reviewers.map((r) => `@${r}`).join(", ")
                        : "None yet"}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-1 text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Description
                    </h3>
                    <pre className="max-h-48 overflow-auto rounded-md bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      {detail.body || "No description."}
                    </pre>
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  Cursor AI
                </h3>
                <p className="text-xs text-neutral-500">
                  Opens a full-screen review flow: GitHub diffs → AI draft → you
                  confirm → only then submit to GitHub.
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to={reviewPath} onClick={() => onOpenChange(false)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Open AI review screen
                  </Link>
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  Review comment
                </h3>
                {templates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => setComment(t.body)}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        title={t.body}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  placeholder="Optional for approve; required for comment / request changes"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  disabled={Boolean(busy)}
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(busy) || shown.isDraft}
                  onClick={() => void runReview("APPROVE")}
                >
                  {busy === "APPROVE" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void runReview("COMMENT")}
                >
                  {busy === "COMMENT" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" />
                  )}
                  Comment
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={Boolean(busy)}
                  onClick={() => void runReview("REQUEST_CHANGES")}
                >
                  {busy === "REQUEST_CHANGES" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Request changes
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={copyLink}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={openInBrowser}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in browser
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
