import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  GitPullRequest,
  Star,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sameGithubLogin } from "@/features/people/login";
import { fetchHeadBranch } from "@/features/pr/api";
import { cn } from "@/lib/cn";
import {
  getFavoriteUsers,
  MAX_FAVORITE_USERS,
  toggleFavoriteBranch,
  toggleFavoriteUser,
} from "@/lib/settings";
import { relativeTime } from "@/lib/time";
import { useFavoriteBranches, useFavoriteUsers } from "@/lib/use-settings";

import { NotReviewedBadge, ReviewStatusBadge } from "./ReviewStatusBadge";
import type { PullRequest } from "./types";

type Props = {
  pr: PullRequest;
  onSelect: (pr: PullRequest) => void;
  /** Updated since last “mark seen” watermark. */
  isNew?: boolean;
  onFilterAuthor?: (login: string) => void;
};

export function PRRow({ pr, onSelect, isNew = false, onFilterAuthor }: Props) {
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

  return (
    <li
      className={cn(
        "group flex items-start gap-3 border-b border-neutral-200 px-3 py-3 last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60",
        reviewed && "bg-sky-50/50 dark:bg-sky-950/20",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <button
          type="button"
          onClick={() => onSelect(pr)}
          className="mt-0.5 shrink-0"
          aria-label="Open pull request"
        >
          {reviewed ? (
            <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          ) : (
            <GitPullRequest
              className={`h-4 w-4 ${
                pr.isDraft
                  ? "text-neutral-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelect(pr)}
            className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left"
          >
            <span
              className={cn(
                "truncate text-sm font-medium",
                reviewed
                  ? "text-neutral-700 dark:text-neutral-300"
                  : "text-neutral-900 dark:text-neutral-100",
              )}
            >
              {pr.title}
            </span>
            <span className="shrink-0 font-mono text-xs text-neutral-400">
              #{pr.number}
            </span>
            {isNew ? (
              <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-sky-800 uppercase dark:bg-sky-950 dark:text-sky-300">
                New
              </span>
            ) : null}
            {pr.isDraft ? (
              <span className="rounded-sm bg-neutral-200 px-1.5 py-0.5 text-xs font-medium tracking-wide text-neutral-600 uppercase dark:bg-neutral-800 dark:text-neutral-400">
                draft
              </span>
            ) : null}
            {pr.localReviewEvent ? (
              <ReviewStatusBadge event={pr.localReviewEvent} compact />
            ) : (
              <NotReviewedBadge />
            )}
            {starred ? (
              <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-medium tracking-wide text-amber-800 uppercase dark:bg-amber-950 dark:text-amber-200">
                Branch favorite
              </span>
            ) : null}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span className="font-mono">{pr.repo}</span>
            {pr.headBranch ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono text-neutral-400">
                  {pr.headBranch}
                  {pr.baseBranch ? ` → ${pr.baseBranch}` : ""}
                </span>
              </>
            ) : pr.baseBranch ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono text-neutral-400">
                  → {pr.baseBranch}
                </span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5">
              {onFilterAuthor ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-neutral-800 dark:hover:text-neutral-200"
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
                className="rounded p-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label={
                  personStarred ? "Remove favorite person" : "Favorite person"
                }
                aria-pressed={personStarred}
                onClick={onTogglePersonFavorite}
              >
                <Star
                  className={cn(
                    "h-3 w-3",
                    personStarred && "fill-amber-400 text-amber-500",
                  )}
                />
              </button>
            </span>
            <span aria-hidden>·</span>
            <span>{relativeTime(pr.updatedAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Favorite branch"
          disabled={busyStar}
          onClick={() => void onToggleBranchFavorite()}
        >
          <Star
            className={cn(
              "h-4 w-4",
              starred && "fill-amber-400 text-amber-500",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Copy link"
          onClick={copyLink}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open in browser"
          onClick={openInBrowser}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
