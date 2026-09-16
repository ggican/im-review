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

import { Badge } from "@/components/ui/badge";
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
  const variant =
    status === "success"
      ? "success"
      : status === "failure"
        ? "error"
        : status === "pending"
          ? "warning"
          : "default";

  return (
    <Badge variant={variant} className="normal-case">
      CI · {status} — {description}
    </Badge>
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
              <div className="text-body-sm text-on-surface-variant flex flex-wrap items-center gap-2">
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
                {shown.isDraft ? <Badge variant="outline">Draft</Badge> : null}
                {shown.headBranch || shown.baseBranch ? (
                  <span className="font-keycap">
                    {shown.headBranch ?? "?"}
                    {shown.baseBranch ? <> → {shown.baseBranch}</> : null}
                  </span>
                ) : null}
                {detail ? (
                  <span className="font-keycap">
                    <span className="text-success">+{detail.additions}</span>{" "}
                    <span className="text-error">−{detail.deletions}</span> ·{" "}
                    {detail.changedFiles} files
                  </span>
                ) : null}
              </div>

              {loading && !detail ? (
                <div className="text-body-sm text-on-surface-variant flex items-center gap-2">
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
                    <h3 className="text-label-sm text-on-surface-variant mb-1 font-medium tracking-wide uppercase">
                      Reviewers
                    </h3>
                    <p className="text-body-sm text-on-surface">
                      {detail.reviewers.length
                        ? detail.reviewers.map((r) => `@${r}`).join(", ")
                        : "None yet"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-label-sm text-on-surface-variant mb-1 font-medium tracking-wide uppercase">
                      Description
                    </h3>
                    <pre className="bg-surface-container-low text-body-sm text-on-surface max-h-48 overflow-auto rounded-md p-3 leading-relaxed whitespace-pre-wrap">
                      {detail.body || "No description."}
                    </pre>
                  </div>
                </>
              ) : null}

              <div className="space-y-2">
                <h3 className="text-label-sm text-on-surface-variant font-medium tracking-wide uppercase">
                  Cursor AI
                </h3>
                <p className="text-body-sm text-on-surface-variant">
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
                <h3 className="text-label-sm text-on-surface-variant font-medium tracking-wide uppercase">
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
                        className="border-border bg-surface-container-low text-label-sm text-on-surface hover:bg-surface-container-high rounded-md border px-2 py-1 font-medium"
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

            <div className="border-border space-y-2 border-t px-5 py-4">
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
