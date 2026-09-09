import { GitBranch, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { fetchOpenPullsForRepo } from "@/features/pr/api";
import type { PullRequest } from "@/features/pr/types";
import { relativeTime } from "@/lib/time";

import type { Repo } from "./types";

type Props = {
  repo: Repo;
  onBack: () => void;
};

function reviewPath(pr: PullRequest): string {
  const [owner, name] = pr.repo.split("/");
  return `/review/${owner}/${name}/${pr.number}`;
}

export function RepoOpenBranchesPanel({ repo, onBack }: Props) {
  const navigate = useNavigate();
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPrs([]);
    void fetchOpenPullsForRepo(repo.fullName)
      .then((list) => {
        if (!cancelled) setPrs(list);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo.fullName]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Button type="button" size="sm" variant="ghost" onClick={onBack}>
            ← Back to repos
          </Button>
          <h2 className="mt-1 truncate text-sm font-semibold">
            {repo.fullName}
          </h2>
          <p className="text-xs text-neutral-500">
            Open PRs / active head branches — click to open in IM Review
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading open PRs…
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : prs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-neutral-500">
            No open pull requests in this repo.
          </div>
        ) : (
          <ul>
            {prs.map((pr) => (
              <li key={`${pr.repo}#${pr.number}`}>
                <button
                  type="button"
                  onClick={() => navigate(reviewPath(pr))}
                  className="flex w-full items-start gap-3 border-b border-neutral-200 px-3 py-3 text-left last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
                >
                  <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs font-medium text-sky-700 dark:text-sky-300">
                        {pr.headBranch ?? "(unknown branch)"}
                      </span>
                      <span className="font-mono text-xs text-neutral-400">
                        #{pr.number}
                      </span>
                      {pr.isDraft ? (
                        <span className="rounded bg-neutral-200 px-1 py-0.5 text-xs font-medium uppercase dark:bg-neutral-800">
                          draft
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-800 dark:text-neutral-200">
                      {pr.title}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {pr.author.login} · {relativeTime(pr.updatedAt)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
