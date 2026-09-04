import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toggleFavorite } from "@/lib/settings";
import { relativeTime } from "@/lib/time";

import type { Repo } from "./types";

type Props = {
  repo: Repo;
  favorited: boolean;
};

export function RepoRow({ repo, favorited }: Props) {
  async function openRepo() {
    try {
      await openUrl(repo.htmlUrl);
    } catch (err) {
      toast.error(String(err));
    }
  }

  return (
    <li className="flex items-start gap-3 border-b border-neutral-200 px-3 py-3 last:border-b-0 dark:border-neutral-800">
      <button
        type="button"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={() => toggleFavorite(repo.fullName)}
        className="mt-0.5 shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-amber-500 dark:hover:bg-neutral-900"
      >
        <Star
          className={cn(
            "h-4 w-4",
            favorited && "fill-amber-400 text-amber-400",
          )}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium">{repo.fullName}</span>
          {repo.private ? (
            <span className="inline-flex items-center gap-0.5 text-xs tracking-wide text-neutral-400 uppercase">
              <Lock className="h-3 w-3" />
              private
            </span>
          ) : null}
        </div>
        {repo.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
            {repo.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-neutral-400">
          {repo.language ? <span>{repo.language}</span> : null}
          {repo.language ? <span aria-hidden>·</span> : null}
          <span>{relativeTime(repo.updatedAt)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open on GitHub"
        onClick={openRepo}
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    </li>
  );
}
