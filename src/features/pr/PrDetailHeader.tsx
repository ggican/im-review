import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { githubReviewStateLabel } from "@/features/pr/review-status";
import { ReviewStatusBadge } from "@/features/pr/ReviewStatusBadge";
import type {
  PrDetail,
  PullRequest,
  ReviewEvent,
  SavedReview,
} from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { favoriteStarClass, favoriteToggleButtonClass } from "@/lib/favorite-styles";
import { relativeTime } from "@/lib/time";

type GithubMyReview = {
  user: string;
  state: string;
};

type Props = {
  owner: string;
  repo: string;
  prNumber: number;
  detail: PrDetail | null;
  pr: PullRequest | null;
  yourReviewEvent?: ReviewEvent;
  githubMyReview?: GithubMyReview;
  localSavedReview?: SavedReview;
  branchStarred: boolean;
  approving: boolean;
  posting: boolean;
  onQuickApprove: () => void;
  onToggleBranchFavorite: () => void;
};

export function PrDetailHeader({
  owner,
  repo,
  prNumber,
  detail,
  pr,
  yourReviewEvent,
  githubMyReview,
  localSavedReview,
  branchStarred,
  approving,
  posting,
  onQuickApprove,
  onToggleBranchFavorite,
}: Props) {
  const draft = Boolean(detail?.isDraft || pr?.isDraft);
  const title = detail?.title ?? pr?.title ?? "Loading PR…";

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <Link to="/?hub=prs" aria-label="Back">
            <ArrowLeft className="h-3.5 w-3.5" />
            Pull Requests
          </Link>
        </Button>
        <span aria-hidden>/</span>
        <span className="font-keycap text-on-surface">
          {owner}/{repo} #{prNumber}
        </span>
        {detail?.headBranch ? (
          <IconButton
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Toggle favorite branch"
            aria-pressed={branchStarred}
            onClick={onToggleBranchFavorite}
          >
            <Star
              className={cn("h-4 w-4", favoriteStarClass(branchStarred))}
            />
          </IconButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-headline text-headline-md font-bold tracking-tight text-on-surface">
              {title}
            </h1>
            {draft ? <Badge variant="outline">Draft</Badge> : null}
            {yourReviewEvent ? (
              <ReviewStatusBadge event={yourReviewEvent} />
            ) : githubMyReview ? (
              <Badge variant="secondary" data-testid="review-status-badge">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                {githubReviewStateLabel(githubMyReview.state)}
              </Badge>
            ) : detail || pr ? (
              <Badge variant="github">Needs review</Badge>
            ) : null}
          </div>

          {localSavedReview ? (
            <p className="mt-1.5 text-body-sm text-on-surface-variant">
              Submitted from IM Review ·{" "}
              {relativeTime(localSavedReview.submittedAt)}
            </p>
          ) : githubMyReview && !yourReviewEvent ? (
            <p className="mt-1.5 text-body-sm text-on-surface-variant">
              Your review on GitHub
            </p>
          ) : null}

          {detail ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                {detail.author.avatarUrl ? (
                  <img
                    src={detail.author.avatarUrl}
                    alt=""
                    className="h-5 w-5 rounded-full"
                  />
                ) : null}
                <span className="font-medium text-on-surface">
                  {detail.author.login}
                </span>
              </span>
              <span aria-hidden>·</span>
              <span>Updated {relativeTime(detail.updatedAt)}</span>
              {detail.headBranch || detail.baseBranch ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-keycap">
                    {detail.headBranch ?? "?"}
                    {detail.baseBranch ? ` → ${detail.baseBranch}` : ""}
                    {detail.headSha
                      ? ` (@${detail.headSha.slice(0, 7)})`
                      : ""}
                  </span>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span>
                {detail.changedFiles} files ·{" "}
                <span className="font-keycap text-success">
                  +{detail.additions}
                </span>{" "}
                <span className="font-keycap text-error">
                  −{detail.deletions}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        {pr ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openUrl(pr.url)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on GitHub
            </Button>
            <Button
              type="button"
              size="sm"
              variant={branchStarred ? "default" : "outline"}
              disabled={!detail?.headBranch}
              aria-pressed={branchStarred}
              onClick={onToggleBranchFavorite}
              className={favoriteToggleButtonClass(branchStarred)}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  branchStarred && "fill-current",
                )}
              />
              {branchStarred ? "Branch favorited" : "Favorite branch"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={approving || posting || !detail || draft}
              onClick={onQuickApprove}
              title="Submit APPROVE review to GitHub"
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve LGTM
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
