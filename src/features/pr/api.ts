import { api } from "@/lib/api";

import type {
  CiCheckItem,
  CiChecksSnapshot,
  CiStatus,
  PrDetail,
  PrReviewComment,
  PrReviewItem,
  PrReviewsSnapshot,
  PullRequest,
  ReviewEvent,
} from "./types";

type SearchResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: SearchItem[];
};

type SearchItem = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft?: boolean;
  created_at: string;
  updated_at: string;
  repository_url: string;
  user: { login: string; avatar_url: string } | null;
  pull_request?: { html_url?: string };
};

function repoFromUrl(repositoryUrl: string): string {
  // https://api.github.com/repos/owner/name
  const marker = "/repos/";
  const i = repositoryUrl.indexOf(marker);
  return i >= 0 ? repositoryUrl.slice(i + marker.length) : repositoryUrl;
}

function mapItem(item: SearchItem): PullRequest {
  return {
    id: item.id,
    number: item.number,
    repo: repoFromUrl(item.repository_url),
    title: item.title,
    url: item.pull_request?.html_url ?? item.html_url,
    state: item.state === "closed" ? "closed" : "open",
    author: {
      login: item.user?.login ?? "unknown",
      avatarUrl: item.user?.avatar_url ?? "",
    },
    isDraft: Boolean(item.draft),
    updatedAt: item.updated_at,
    createdAt: item.created_at,
  };
}

async function searchPrs(query: string): Promise<PullRequest[]> {
  const q = encodeURIComponent(query);
  const data = await api.githubGet<SearchResponse>(
    `/search/issues?q=${q}&per_page=50&sort=updated`,
  );
  return (data.items ?? []).map(mapItem);
}

export async function fetchAssignedPrs(): Promise<PullRequest[]> {
  return searchPrs("is:pr is:open assignee:@me");
}

export async function fetchReviewRequestedPrs(): Promise<PullRequest[]> {
  return searchPrs("is:pr is:open review-requested:@me");
}

export async function fetchMyOpenPrs(): Promise<PullRequest[]> {
  return searchPrs("is:pr is:open author:@me");
}

/** ISO date (YYYY-MM-DD) for metrics window start. `days=0` is today. */
export function metricsWindowFrom(days = 7): string {
  const from = new Date();
  from.setDate(from.getDate() - days);
  return from.toISOString().slice(0, 10);
}

export async function fetchAuthoredPrsInWindow(
  fromDate: string,
): Promise<PullRequest[]> {
  return searchPrs(`is:pr author:@me created:>=${fromDate}`);
}

export async function fetchReviewedPrsInWindow(
  fromDate: string,
): Promise<PullRequest[]> {
  return searchPrs(`is:pr reviewed-by:@me updated:>=${fromDate}`);
}

export async function fetchMergedPrsInWindow(
  fromDate: string,
): Promise<PullRequest[]> {
  return searchPrs(`is:pr author:@me is:merged merged:>=${fromDate}`);
}

/** Commit count on a PR (proxy for post-open churn). */
export async function fetchPrCommitCount(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<number> {
  const { owner, name } = splitRepo(pr.repo);
  const data = await api.githubGet<Array<{ sha: string }>>(
    `/repos/${owner}/${name}/pulls/${pr.number}/commits?per_page=100`,
  );
  return data?.length ?? 0;
}

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo: ${repo}`);
  return { owner, name };
}

type GhPull = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  html_url: string;
  state: string;
  draft: boolean;
  body: string | null;
  created_at: string;
  updated_at: string;
  additions: number;
  deletions: number;
  changed_files: number;
  merged_at: string | null;
  user: { login: string; avatar_url: string };
  head: { sha: string; ref: string };
  requested_reviewers?: { login: string }[];
};

type GhReview = {
  id: number;
  user: { login: string; avatar_url: string } | null;
  state: string;
  body: string | null;
  submitted_at: string | null;
  html_url: string;
};

type GhReviewComment = {
  id: number;
  pull_request_review_id: number | null;
  path: string;
  line: number | null;
  original_line?: number | null;
  body: string;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
  html_url: string;
};

type GhCombinedStatus = {
  state: string;
  statuses: Array<{
    id?: number;
    context: string;
    state: string;
    description: string | null;
    target_url: string | null;
    updated_at?: string;
  }>;
};

type GhCheckRunsResponse = {
  total_count: number;
  check_runs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string | null;
    details_url?: string | null;
    output?: { title: string | null; summary: string | null };
    completed_at: string | null;
    started_at: string | null;
  }>;
};

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

function mapCheckRunState(status: string, conclusion: string | null): CiStatus {
  if (status !== "completed") return "pending";
  switch (conclusion) {
    case "success":
    case "neutral":
    case "skipped":
      return "success";
    case "failure":
    case "timed_out":
    case "cancelled":
    case "action_required":
    case "startup_failure":
      return "failure";
    default:
      return conclusion ? "failure" : "pending";
  }
}

function overallFromItems(items: CiCheckItem[]): CiStatus {
  if (items.length === 0) return "none";
  if (items.some((i) => i.state === "failure")) return "failure";
  if (items.some((i) => i.state === "pending")) return "pending";
  if (items.every((i) => i.state === "success")) return "success";
  return "none";
}

/** Fetch Jenkins/GitHub CI results for a PR head SHA (statuses + check runs). */
export async function fetchPrCiChecks(
  pr: Pick<PullRequest, "repo">,
  headSha: string,
): Promise<CiChecksSnapshot> {
  const { owner, name } = splitRepo(pr.repo);
  const base = `/repos/${owner}/${name}`;
  const items: CiCheckItem[] = [];

  const [statusRes, checksRes] = await Promise.allSettled([
    api.githubGet<GhCombinedStatus>(`${base}/commits/${headSha}/status`),
    api.githubGet<GhCheckRunsResponse>(
      `${base}/commits/${headSha}/check-runs?per_page=100`,
    ),
  ]);

  if (statusRes.status === "fulfilled") {
    for (const s of statusRes.value.statuses ?? []) {
      items.push({
        id: `status-${s.id ?? s.context}`,
        name: s.context,
        state: mapCi(s.state),
        description: s.description?.trim() || s.state,
        targetUrl: s.target_url,
        source: "status",
        updatedAt: s.updated_at ?? null,
      });
    }
  }

  if (checksRes.status === "fulfilled") {
    for (const run of checksRes.value.check_runs ?? []) {
      const state = mapCheckRunState(run.status, run.conclusion);
      const title = run.output?.title?.trim();
      const summary = run.output?.summary?.trim();
      items.push({
        id: `check-${run.id}`,
        name: run.name,
        state,
        description:
          title || summary?.slice(0, 200) || run.conclusion || run.status,
        targetUrl: run.details_url || run.html_url,
        source: "check_run",
        updatedAt: run.completed_at ?? run.started_at,
      });
    }
  }

  // Prefer failing / pending first so Jenkins red builds surface.
  const rank: Record<CiStatus, number> = {
    failure: 0,
    pending: 1,
    none: 2,
    success: 3,
  };
  items.sort(
    (a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name),
  );

  return {
    overall: overallFromItems(items),
    sha: headSha,
    items,
    failedCount: items.filter((i) => i.state === "failure").length,
    pendingCount: items.filter((i) => i.state === "pending").length,
    successCount: items.filter((i) => i.state === "success").length,
  };
}

export async function fetchPrDetail(pr: PullRequest): Promise<PrDetail> {
  const { owner, name } = splitRepo(pr.repo);
  const base = `/repos/${owner}/${name}`;

  const [raw, reviews] = await Promise.all([
    api.githubGet<GhPull>(`${base}/pulls/${pr.number}`),
    api.githubGet<GhReview[]>(`${base}/pulls/${pr.number}/reviews`),
  ]);

  let ciStatus: CiStatus = "none";
  let ciDescription = "No status checks";
  try {
    const status = await api.githubGet<GhCombinedStatus>(
      `${base}/commits/${raw.head.sha}/status`,
    );
    ciStatus = mapCi(status.state);
    const failing = status.statuses?.filter(
      (s) => s.state === "failure" || s.state === "error",
    );
    if (failing?.length) {
      ciDescription = failing.map((s) => s.context).join(", ");
    } else if (status.statuses?.length) {
      ciDescription = `${status.statuses.length} check(s) · ${status.state}`;
    } else if (status.state && status.state !== "pending") {
      ciDescription = status.state;
    }
  } catch {
    // status endpoint can 404 on some repos; ignore
  }

  const reviewerSet = new Set<string>();
  for (const r of raw.requested_reviewers ?? []) reviewerSet.add(r.login);
  for (const r of reviews ?? []) {
    if (r.user?.login) reviewerSet.add(r.user.login);
  }

  return {
    id: raw.id,
    number: raw.number,
    repo: pr.repo,
    title: raw.title,
    url: raw.html_url,
    state: raw.merged_at
      ? "merged"
      : raw.state === "closed"
        ? "closed"
        : "open",
    author: { login: raw.user.login, avatarUrl: raw.user.avatar_url },
    isDraft: raw.draft,
    updatedAt: raw.updated_at,
    createdAt: raw.created_at,
    body: raw.body?.trim() || "",
    headSha: raw.head.sha,
    headBranch: raw.head.ref,
    nodeId: raw.node_id,
    mergedAt: raw.merged_at,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changed_files,
    reviewers: [...reviewerSet],
    ciStatus,
    ciDescription,
  };
}

/** Resolve PR head branch (for starring from list without full detail). */
export async function fetchHeadBranch(
  pr: Pick<PullRequest, "repo" | "number" | "headBranch">,
): Promise<string> {
  if (pr.headBranch?.trim()) return pr.headBranch.trim();
  const { owner, name } = splitRepo(pr.repo);
  const raw = await api.githubGet<{ head: { ref: string } }>(
    `/repos/${owner}/${name}/pulls/${pr.number}`,
  );
  const ref = raw.head?.ref?.trim();
  if (!ref) throw new Error("PR has no head branch");
  return ref;
}

/** Load submitted reviews + inline comments for the Current reviews tab. */
export async function fetchPrReviews(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<PrReviewsSnapshot> {
  const { owner, name } = splitRepo(pr.repo);
  const base = `/repos/${owner}/${name}/pulls/${pr.number}`;

  const [rawReviews, rawComments] = await Promise.all([
    api.githubGet<GhReview[]>(`${base}/reviews?per_page=100`),
    api.githubGet<GhReviewComment[]>(`${base}/comments?per_page=100`),
  ]);

  const commentsByReview = new Map<number, PrReviewComment[]>();
  let inlineCount = 0;
  for (const c of rawComments ?? []) {
    inlineCount += 1;
    const mapped: PrReviewComment = {
      id: c.id,
      path: c.path,
      line: c.line ?? c.original_line ?? null,
      body: c.body?.trim() || "",
      user: c.user?.login ?? "unknown",
      avatarUrl: c.user?.avatar_url ?? "",
      createdAt: c.created_at,
      htmlUrl: c.html_url,
      reviewId: c.pull_request_review_id,
    };
    if (c.pull_request_review_id == null) continue;
    const list = commentsByReview.get(c.pull_request_review_id) ?? [];
    list.push(mapped);
    commentsByReview.set(c.pull_request_review_id, list);
  }

  const reviews: PrReviewItem[] = (rawReviews ?? [])
    .filter((r) => r.state !== "PENDING")
    .map((r) => ({
      id: r.id,
      user: r.user?.login ?? "unknown",
      avatarUrl: r.user?.avatar_url ?? "",
      state: r.state,
      body: r.body?.trim() || "",
      submittedAt: r.submitted_at,
      htmlUrl: r.html_url,
      comments: commentsByReview.get(r.id) ?? [],
    }))
    .sort((a, b) => {
      const at = a.submittedAt ?? "";
      const bt = b.submittedAt ?? "";
      return bt.localeCompare(at);
    });

  // Latest submission per user (GitHub UI style).
  const latestMap = new Map<
    string,
    { user: string; avatarUrl: string; state: string; at: string }
  >();
  for (const r of [...reviews].reverse()) {
    latestMap.set(r.user, {
      user: r.user,
      avatarUrl: r.avatarUrl,
      state: r.state,
      at: r.submittedAt ?? "",
    });
  }
  const latestByUser = [...latestMap.values()].sort((a, b) =>
    b.at.localeCompare(a.at),
  );

  return { reviews, latestByUser, inlineCount };
}

export async function submitReview(
  pr: Pick<PullRequest, "repo" | "number">,
  event: ReviewEvent,
  body: string,
  options?: {
    commitId?: string;
    comments?: Array<{
      path: string;
      body: string;
      line: number;
      side?: "LEFT" | "RIGHT";
    }>;
  },
): Promise<void> {
  const { owner, name } = splitRepo(pr.repo);
  const trimmed = body.trim();
  const comments = options?.comments ?? [];
  const payload: {
    event: ReviewEvent;
    body?: string;
    commit_id?: string;
    comments?: Array<{
      path: string;
      body: string;
      line: number;
      side: "LEFT" | "RIGHT";
    }>;
  } = { event };

  if (trimmed) payload.body = trimmed;
  if (options?.commitId) payload.commit_id = options.commitId;
  if (comments.length) {
    payload.comments = comments.map((c) => ({
      path: c.path,
      body: c.body,
      line: c.line,
      side: c.side ?? "RIGHT",
    }));
  }

  if (
    (event === "REQUEST_CHANGES" || event === "COMMENT") &&
    !trimmed &&
    comments.length === 0
  ) {
    throw new Error("A comment body or inline comments are required");
  }

  await api.githubRequest(
    "POST",
    `/repos/${owner}/${name}/pulls/${pr.number}/reviews`,
    payload,
  );
}

export async function postIssueComment(
  pr: Pick<PullRequest, "repo" | "number">,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Comment cannot be empty");
  const { owner, name } = splitRepo(pr.repo);
  await api.githubRequest(
    "POST",
    `/repos/${owner}/${name}/issues/${pr.number}/comments`,
    { body: trimmed },
  );
}

/** Close an open PR (author only). */
export async function closePullRequest(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<void> {
  const { owner, name } = splitRepo(pr.repo);
  await api.githubRequest(
    "PATCH",
    `/repos/${owner}/${name}/pulls/${pr.number}`,
    { state: "closed" },
  );
}

/** Reopen a closed (unmerged) PR. */
export async function reopenPullRequest(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<void> {
  const { owner, name } = splitRepo(pr.repo);
  await api.githubRequest(
    "PATCH",
    `/repos/${owner}/${name}/pulls/${pr.number}`,
    { state: "open" },
  );
}

/** Convert open PR to draft (author). Uses GitHub GraphQL. */
export async function convertPullRequestToDraft(nodeId: string): Promise<void> {
  if (!nodeId.trim()) throw new Error("Missing PR node id");
  const data = await api.githubRequest<{
    data?: {
      convertPullRequestToDraft?: { pullRequest?: { isDraft?: boolean } };
    };
    errors?: Array<{ message: string }>;
  }>("POST", "/graphql", {
    query: `mutation($id: ID!) {
      convertPullRequestToDraft(input: { pullRequestId: $id }) {
        pullRequest { isDraft }
      }
    }`,
    variables: { id: nodeId },
  });
  const message = data.errors?.[0]?.message;
  if (message) throw new Error(message);
}

/** Mark draft PR ready for review. */
export async function markPullRequestReady(
  pr: Pick<PullRequest, "repo" | "number">,
): Promise<void> {
  const { owner, name } = splitRepo(pr.repo);
  await api.githubRequest(
    "POST",
    `/repos/${owner}/${name}/pulls/${pr.number}/ready_for_review`,
  );
}
