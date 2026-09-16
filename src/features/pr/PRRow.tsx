import { openUrl } from "@tauri-apps/plugin-opener";
import { Copy, ExternalLink, GitPullRequest, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { sameGithubLogin } from "@/features/people/login";
import { fetchHeadBranch } from "@/features/pr/api";
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
import {
  getFavoriteUsers,
  MAX_FAVORITE_USERS,
  toggleFavoriteBranch,
  toggleFavoriteUser,
} from "@/lib/settings";
import { relativeTime } from "@/lib/time";
import { useFavoriteBranches, useFavoriteUsers } from "@/lib/use-settings";

import { NeedsReviewBadge, ReviewStatusBadge } from "./ReviewStatusBadge";
import type { PullRequest } from "./types";

type Props = {
  pr: PullRequest;
  onSelect: (pr: PullRequest) => void;
  /** Updated since last “mark seen” watermark. */
  isNew?: boolean;
  onFilterAuthor?: (login: string) => void;
  /** Optional CI failure description from mine-PR scan. */
  ciFailure?: string | null;
};

export function PRRow({
  pr,
  onSelect,
  isNew = false,
  onFilterAuthor,
  ciFailure = null,
}: Props) {
  const favoriteBranches = useFavoriteBranches();
  const favoriteUsers = useFavoriteUsers();
  const [busyStar, setBusyStar] = useState(false);
  const reviewed = Boolean(pr.localReviewEvent);
  const starred = favoriteBranches.some(
    (b) =>
      b.repo === pr.repo &&
      (pr.headBranch ? b.branch === pr.headBranch : b.prNumber === pr.number),
  );
  const personStarred = favoriteUsers.some((u) =>
    sameGithubLogin(u.login, pr.author.login),
  );

  async function openInBrowser() {
    try {
      await openUrl(pr.url);
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pr.url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function onToggleBranchFavorite() {
    setBusyStar(true);
    try {
      const branch = await fetchHeadBranch(pr);
      const next = toggleFavoriteBranch({
        repo: pr.repo,
        branch,
        prNumber: pr.number,
        title: pr.title,
        url: pr.url,
      });
      const nowOn = next.some((b) => b.repo === pr.repo && b.branch === branch);
      toast.success(
        nowOn ? `Favorited branch ${branch}` : `Removed favorite ${branch}`,
      );
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusyStar(false);
    }
  }

  function onTogglePersonFavorite() {
    if (!personStarred && getFavoriteUsers().length >= MAX_FAVORITE_USERS) {
      toast.error(`Favorite people limit is ${MAX_FAVORITE_USERS}`);
      return;
    }
    const next = toggleFavoriteUser({
      login: pr.author.login,
      name: null,
      avatarUrl: pr.author.avatarUrl,
      htmlUrl: `https://github.com/${pr.author.login}`,
    });
    const nowOn = next.some((u) => sameGithubLogin(u.login, pr.author.login));
    toast.success(
      nowOn
        ? `Favorited @${pr.author.login}`
        : `Removed @${pr.author.login} from people`,
    );
  }

  const branchLabel = pr.headBranch
    ? `${pr.headBranch}${pr.baseBranch ? ` → ${pr.baseBranch}` : ""}`
    : pr.baseBranch
      ? `→ ${pr.baseBranch}`
      : null;

  return (
    <li
      className={cn(
        "group border-border bg-surface-container-lowest flex flex-col gap-2 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-3",
        "hover:bg-surface-container-low/70",
        pr.isDraft && !reviewed && "opacity-95",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <IconButton
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={starred ? "Remove favorite branch" : "Favorite branch"}
          aria-pressed={starred}
          disabled={busyStar}
          className="text-on-surface-variant focus-visible:ring-primary-container/70 mt-0.5 shrink-0 focus-visible:ring-2"
          onClick={() => void onToggleBranchFavorite()}
        >
          <Star className={cn("h-4 w-4", favoriteStarClass(starred))} />
        </IconButton>

        <button
          type="button"
          onClick={() => onSelect(pr)}
          className="text-on-surface-variant focus-visible:ring-primary-container mt-0.5 shrink-0 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Open pull request"
        >
          <GitPullRequest className="h-4 w-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-keycap border-border bg-surface-container-low text-on-surface rounded-md border px-1.5 py-0.5">
              {pr.repo} #{pr.number}
            </span>
            {isNew ? <Badge variant="accent">New</Badge> : null}
            {pr.isDraft ? <Badge variant="outline">Draft</Badge> : null}
            {ciFailure ? <Badge variant="error">CI failed</Badge> : null}
            {pr.localReviewEvent ? (
              <ReviewStatusBadge event={pr.localReviewEvent} />
            ) : (
              <NeedsReviewBadge />
            )}
            {starred ? <Badge variant="warning">Branch favorite</Badge> : null}
          </div>

          <button
            type="button"
            onClick={() => onSelect(pr)}
            className={cn(
              "text-title-md mt-1 w-full text-left font-semibold tracking-tight",
              reviewed || pr.isDraft
                ? "text-on-surface-variant"
                : "text-on-surface",
            )}
          >
            {pr.title}
          </button>

          <div className="text-body-sm text-on-surface-variant mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {ciFailure ? (
              <Badge variant="error" className="font-normal normal-case">
                {ciFailure}
              </Badge>
            ) : null}
            {branchLabel ? (
              <span className="font-keycap text-on-surface">{branchLabel}</span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              {onFilterAuthor ? (
                <button
                  type="button"
                  className="hover:text-on-surface inline-flex items-center gap-1"
                  onClick={() => onFilterAuthor(pr.author.login)}
                >
                  {pr.author.avatarUrl ? (
                    <img
                      src={pr.author.avatarUrl}
                      alt=""
                      className="h-3.5 w-3.5 rounded-full"
                    />
                  ) : null}
                  {pr.author.login}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {pr.author.avatarUrl ? (
                    <img
                      src={pr.author.avatarUrl}
                      alt=""
                      className="h-3.5 w-3.5 rounded-full"
                    />
                  ) : null}
                  {pr.author.login}
                </span>
              )}
              <button
                type="button"
                className="hover:bg-surface-container-high rounded p-0.5"
                aria-label={
                  personStarred ? "Remove favorite person" : "Favorite person"
                }
                aria-pressed={personStarred}
                onClick={onTogglePersonFavorite}
              >
                <Star
                  className={cn("h-3 w-3", favoriteStarClass(personStarred))}
                />
              </button>
            </span>
            <span aria-hidden>·</span>
            <span>Updated {relativeTime(pr.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:pt-0.5">
        <Button
          type="button"
          size="sm"
          variant={reviewed ? "outline" : pr.isDraft ? "secondary" : "default"}
          onClick={() => onSelect(pr)}
        >
          {pr.isDraft ? "View Draft Diff" : "Review Diff"}
        </Button>
        <IconButton
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Copy link"
          onClick={copyLink}
        >
          <Copy className="h-4 w-4" />
        </IconButton>
        <IconButton
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Open in browser"
          onClick={openInBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </IconButton>
      </div>
    </li>
  );
}
