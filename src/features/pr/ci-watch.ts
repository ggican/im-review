import { api } from "@/lib/api";

import type { CiStatus, PullRequest } from "./types";

export type CiWatchHit = {
  pr: PullRequest;
  ciStatus: CiStatus;
  description: string;
};

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  return { owner: owner ?? "", name: name ?? "" };
}

function mapCi(state: string | undefined): CiStatus {
  switch (state) {
    case "success":
      return "success";
    case "failure":
    case "error":
      return "failure";
    case "pending":
      return "pending";
    default:
      return "none";
  }
}

/**
 * Lightweight CI scan for authored PRs (status endpoint only).
 * Caps concurrency to avoid hammering GitHub on every refresh.
 */
export async function scanMineCiFailures(
  mine: PullRequest[],
  limit = 6,
): Promise<CiWatchHit[]> {
  const targets = mine
    .filter((pr) => !pr.isDraft && !pr.fromLocalReview)
    .slice(0, limit);
  const hits: CiWatchHit[] = [];

  await Promise.all(
    targets.map(async (pr) => {
      try {
        const { owner, name } = splitRepo(pr.repo);
        if (!owner || !name) return;
        const raw = await api.githubGet<{
          head: { sha: string };
          title: string;
        }>(`/repos/${owner}/${name}/pulls/${pr.number}`);
        const status = await api.githubGet<{
          state: string;
          statuses?: Array<{ state: string; context: string }>;
        }>(`/repos/${owner}/${name}/commits/${raw.head.sha}/status`);
        const ciStatus = mapCi(status.state);
        if (ciStatus !== "failure") return;
        const failing = (status.statuses ?? [])
          .filter((s) => s.state === "failure" || s.state === "error")
          .map((s) => s.context);
        hits.push({
          pr: { ...pr, title: raw.title || pr.title },
          ciStatus,
          description: failing.length ? failing.join(", ") : "CI failed",
        });
      } catch {
        // ignore per-PR failures (404, rate limit, etc.)
      }
    }),
  );

  return hits.sort((a, b) => a.pr.repo.localeCompare(b.pr.repo));
}
