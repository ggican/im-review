import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, ExternalLink, Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
import { toggleFavorite } from "@/lib/settings";
import { relativeTime } from "@/lib/time";

import type { Repo } from "./types";

type Props = {
  repo: Repo;
  favorited: boolean;
  onOpenDetail?: (repo: Repo) => void;
};

export function RepoRow({ repo, favorited, onOpenDetail }: Props) {
  const [owner, name] = repo.fullName.split("/");

  async function openRepo() {
    try {
      await openUrl(repo.htmlUrl);
    } catch (err) {
      toast.error(String(err));
    }
  }

  return (
    <li className="flex items-start gap-3 border-b border-border px-3 py-3 last:border-b-0">
      <button
        type="button"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={() => toggleFavorite(repo.fullName)}
        className="mt-0.5 shrink-0 rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/70"
      >
        <Star className={cn("h-4 w-4", favoriteStarClass(favorited))} />
      </button>
      <button
        type="button"
        onClick={() => onOpenDetail?.(repo)}
        className="min-w-0 flex-1 rounded-md text-left hover:bg-surface-container-low/60"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-body-md font-medium text-on-surface">
            {name ?? repo.fullName}
          </span>
          {owner ? (
            <span className="font-mono text-xs text-on-surface-variant">
              {owner}
            </span>
          ) : null}
          {repo.private ? (
            <Badge variant="outline" className="gap-0.5 uppercase">
              <Lock className="h-3 w-3" aria-hidden />
              private
            </Badge>
          ) : null}
        </div>
        {repo.description ? (
          <p className="mt-0.5 line-clamp-2 text-body-sm text-on-surface-variant">
            {repo.description}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-body-sm text-on-surface-variant">
          {repo.language ? <span>{repo.language}</span> : null}
          {repo.language ? <span aria-hidden>·</span> : null}
          <span className="font-keycap">{relativeTime(repo.updatedAt)}</span>
          {onOpenDetail ? (
            <span className="inline-flex items-center gap-0.5 text-primary">
              Open PRs
              <ChevronRight className="h-3 w-3" />
            </span>
          ) : null}
        </div>
      </button>
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
