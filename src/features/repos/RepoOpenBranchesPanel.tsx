import { GitBranch } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
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
    <section className="space-y-4">
      <PageHeader
        title={repo.fullName}
        subtitle="Open PRs / active head branches — click to open in IM Review"
        leading={
          <Badge variant="github" className="mt-1">
            Repo
          </Badge>
        }
        actions={
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            Back to repos
          </Button>
        }
      />

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <LoadingBlock embedded>Loading open PRs…</LoadingBlock>
        ) : error ? (
          <ErrorBlock className="m-3">{error}</ErrorBlock>
        ) : prs.length === 0 ? (
          <div className="text-body-md text-on-surface-variant px-4 py-12 text-center">
            No open pull requests in this repo.
          </div>
        ) : (
          <ul>
            {prs.map((pr) => (
              <li
                key={`${pr.repo}#${pr.number}`}
                className="border-border border-b last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => navigate(reviewPath(pr))}
                  className="hover:bg-surface-container-low/60 flex w-full items-start gap-3 px-3 py-3 text-left"
                >
                  <GitBranch
                    className="text-on-surface-variant mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-primary font-mono text-xs font-medium">
                        {pr.headBranch ?? "(unknown branch)"}
                      </span>
                      <span className="text-on-surface-variant font-mono text-xs">
                        #{pr.number}
                      </span>
                      {pr.isDraft ? (
                        <Badge variant="secondary" className="uppercase">
                          draft
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-body-md text-on-surface mt-0.5 truncate">
                      {pr.title}
                    </p>
                    <p className="text-body-sm text-on-surface-variant mt-0.5">
                      {pr.author.login} · {relativeTime(pr.updatedAt)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
