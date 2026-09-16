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
    <li className="border-border flex items-start gap-3 border-b px-3 py-3 last:border-b-0">
      <button
        type="button"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={() => toggleFavorite(repo.fullName)}
        className="text-on-surface-variant hover:bg-surface-container-low hover:text-warning focus-visible:ring-primary-container/70 mt-0.5 shrink-0 rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        <Star className={cn("h-4 w-4", favoriteStarClass(favorited))} />
      </button>
      <button
        type="button"
        onClick={() => onOpenDetail?.(repo)}
        className="hover:bg-surface-container-low/60 min-w-0 flex-1 rounded-md text-left"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-body-md text-on-surface truncate font-medium">
            {name ?? repo.fullName}
          </span>
          {owner ? (
            <span className="text-on-surface-variant font-mono text-xs">
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
          <p className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
            {repo.description}
          </p>
        ) : null}
        <div className="text-body-sm text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-2">
          {repo.language ? <span>{repo.language}</span> : null}
          {repo.language ? <span aria-hidden>·</span> : null}
          <span className="font-keycap">{relativeTime(repo.updatedAt)}</span>
          {onOpenDetail ? (
            <span className="text-primary inline-flex items-center gap-0.5">
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
