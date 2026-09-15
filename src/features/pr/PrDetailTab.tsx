import {
  CheckCircle2,
  Circle,
  FilePenLine,
  Loader2,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ChangedFile } from "@/features/ai-review/generate";
import type {
  CiChecksSnapshot,
  PrDetail,
  PrReviewsSnapshot,
  PullRequest,
  ReviewEvent,
} from "@/features/pr/types";
import type { CommentTemplate } from "@/lib/settings";

const DEFAULT_APPROVE_BODY = "LGTM, thanks!";

type OwnerAction = "close" | "reopen" | "draft" | "ready" | null;

type Props = {
  detail: PrDetail | null;
  pr: PullRequest | null;
  files: ChangedFile[];
  reviews: PrReviewsSnapshot | null;
  ci: CiChecksSnapshot | null;
  canManageOwnPr: boolean;
  ownerAction: OwnerAction;
  approving: boolean;
  posting: boolean;
  approveBody: string;
  setApproveBody: (v: string) => void;
  templates: CommentTemplate[];
  yourReviewEvent?: ReviewEvent;
  onQuickApprove: () => void;
  onSetConfirmAction: (action: "close" | "draft") => void;
  onMarkReady: () => void;
  onReopen: () => void;
  onOpenCiTab: () => void;
};

export function PrDetailTab({
  detail,
  pr,
  files,
  reviews,
  ci,
  canManageOwnPr,
  ownerAction,
  approving,
  posting,
  approveBody,
  setApproveBody,
  templates,
  yourReviewEvent,
  onQuickApprove,
  onSetConfirmAction,
  onMarkReady,
  onReopen,
  onOpenCiTab,
}: Props) {
  const draft = Boolean(detail?.isDraft || pr?.isDraft);
  const filePreview = files.slice(0, 8);

  return (
    <section className="grid gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-7">
        <Card padding="default">
          <CardHeader className="mb-2 flex-row items-center justify-between gap-2">
            <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
              Pull request description
            </CardTitle>
            <span className="text-body-sm text-on-surface-variant">
              Plain text
            </span>
          </CardHeader>
          <CardContent>
            {detail?.body?.trim() ? (
              <pre className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-surface-container-low p-3 text-body-md leading-relaxed whitespace-pre-wrap text-on-surface">
                {detail.body}
              </pre>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-body-md text-on-surface-variant">
                No description.
              </p>
            )}
          </CardContent>
        </Card>

        <Card padding="default">
          <CardHeader className="mb-2">
            <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
              Modified files ({files.length || detail?.changedFiles || 0})
            </CardTitle>
            <CardDescription>
              Preview of changed paths — open the Files tab for diffs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filePreview.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                {detail ? "No file list loaded yet." : "Loading files…"}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {filePreview.map((f) => (
                  <li
                    key={f.filename}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="font-keycap truncate text-body-sm text-on-surface">
                      {f.filename}
                    </span>
                    <span className="shrink-0 font-keycap text-body-sm">
                      <span className="text-success">+{f.additions}</span>{" "}
                      <span className="text-error">−{f.deletions}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {files.length > filePreview.length ? (
              <p className="mt-2 text-body-sm text-on-surface-variant">
                +{files.length - filePreview.length} more in Files tab
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-5">
        <Card padding="default">
          <CardHeader className="mb-2">
            <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
              Review status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {yourReviewEvent ? (
              <div className="rounded-lg border border-stream-ai-border bg-stream-ai/50 px-3 py-2">
                <p className="text-label-md text-stream-ai-fg">Your review</p>
                <p className="mt-1 text-body-sm text-on-surface">
                  {yourReviewEvent === "APPROVE"
                    ? "Approved"
                    : yourReviewEvent === "REQUEST_CHANGES"
                      ? "Changes requested"
                      : "Commented"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-stream-github-border bg-stream-github/50 px-3 py-2">
                <p className="text-label-md text-stream-github-fg">
                  Not reviewed yet
                </p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  No review submitted from IM Review for this PR.
                </p>
              </div>
            )}
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase">
                Reviewers
              </p>
              {reviews?.latestByUser?.length ? (
                <ul className="mt-2 space-y-2">
                  {reviews.latestByUser.map((r) => (
                    <li
                      key={r.user}
                      className="flex items-center justify-between gap-2 text-body-sm"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {r.avatarUrl ? (
                          <img
                            src={r.avatarUrl}
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                        ) : null}
                        {r.user}
                      </span>
                      <ReviewerStateBadge state={r.state} />
                    </li>
                  ))}
                </ul>
              ) : detail?.reviewers?.length ? (
                <p className="mt-1 text-body-sm text-on-surface">
                  {detail.reviewers.join(", ")}
                </p>
              ) : (
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  None listed
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {detail ? (
          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-body-sm">
                <MetaRow label="Author">
                  <span className="inline-flex items-center gap-1.5">
                    {detail.author.avatarUrl ? (
                      <img
                        src={detail.author.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : null}
                    {detail.author.login}
                  </span>
                </MetaRow>
                <MetaRow label="Branch">
                  <span className="font-keycap">
                    {detail.headBranch || detail.baseBranch
                      ? `${detail.headBranch ?? "?"}${detail.baseBranch ? ` → ${detail.baseBranch}` : ""}`
                      : "—"}
                  </span>
                </MetaRow>
                <MetaRow label="Diff">
                  <span className="font-keycap">
                    <span className="text-success">+{detail.additions}</span>{" "}
                    <span className="text-error">−{detail.deletions}</span> ·{" "}
                    {detail.changedFiles} files
                  </span>
                </MetaRow>
                <MetaRow label="CI">
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-on-surface"
                    onClick={onOpenCiTab}
                  >
                    {ci?.overall ?? detail.ciStatus} ·{" "}
                    {ci
                      ? `${ci.failedCount} failed · ${ci.pendingCount} pending · ${ci.successCount} passed`
                      : detail.ciDescription}
                  </button>
                </MetaRow>
                <MetaRow label="State">
                  {detail.state === "closed" ? (
                    <Badge variant="error">Closed</Badge>
                  ) : detail.isDraft ? (
                    <Badge variant="warning">Draft</Badge>
                  ) : (
                    <Badge variant="success">Open</Badge>
                  )}
                </MetaRow>
              </dl>
            </CardContent>
          </Card>
        ) : null}

        {canManageOwnPr && detail ? (
          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-title-md">Your PR controls</CardTitle>
              <CardDescription>
                Close the PR, or turn it into a draft so it stops looking ready
                for review. Only shown on PRs you authored.
              </CardDescription>
              {detail.state === "closed" ? (
                <p className="mt-2 text-body-sm font-medium text-error">
                  Status: closed
                </p>
              ) : detail.isDraft ? (
                <p className="mt-2 text-body-sm font-medium text-warning">
                  Status: draft
                </p>
              ) : (
                <p className="mt-2 text-body-sm font-medium text-success">
                  Status: open
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {detail.state === "open" ? (
                  <>
                    {!detail.isDraft ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ownerAction != null || approving || posting}
                        onClick={() => onSetConfirmAction("draft")}
                      >
                        {ownerAction === "draft" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FilePenLine className="h-3.5 w-3.5" />
                        )}
                        Convert to draft
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ownerAction != null || approving || posting}
                        onClick={onMarkReady}
                      >
                        {ownerAction === "ready" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Mark ready for review
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={ownerAction != null || approving || posting}
                      onClick={() => onSetConfirmAction("close")}
                    >
                      {ownerAction === "close" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Close PR
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={ownerAction != null || approving || posting}
                    onClick={onReopen}
                  >
                    {ownerAction === "reopen" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    Reopen PR
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card
          padding="default"
          className="border-stream-ai-border bg-stream-ai/30"
        >
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md text-stream-ai-fg">
              Quick approve
            </CardTitle>
            <CardDescription>
              For small changes — submit an APPROVE review to GitHub without
              running AI. Edit the message if needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={approving || posting}
                    onClick={() => setApproveBody(t.body)}
                    className="rounded-md border border-border bg-surface-container-lowest px-2 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-low"
                    title={t.body}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : null}
            <Textarea
              rows={3}
              value={approveBody}
              onChange={(e) => setApproveBody(e.currentTarget.value)}
              disabled={approving || posting}
              placeholder={DEFAULT_APPROVE_BODY}
            />
            <Button
              type="button"
              size="sm"
              disabled={approving || posting || !detail || !pr || draft}
              onClick={onQuickApprove}
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve & submit to GitHub
            </Button>
            {draft ? (
              <p className="text-body-sm text-warning">
                Draft PRs cannot be approved until marked ready for review.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-label-sm tracking-wide text-on-surface-variant uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-on-surface">{children}</dd>
    </div>
  );
}

function ReviewerStateBadge({ state }: { state: string }) {
  const upper = state.toUpperCase();
  if (upper === "APPROVED") {
    return <Badge variant="success">Approved</Badge>;
  }
  if (upper === "CHANGES_REQUESTED") {
    return <Badge variant="error">Changes</Badge>;
  }
  if (upper === "COMMENTED") {
    return <Badge variant="secondary">Commented</Badge>;
  }
  return <Badge variant="warning">Pending</Badge>;
}
