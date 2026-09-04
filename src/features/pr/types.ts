export type CiStatus = "success" | "failure" | "pending" | "none";

/** One CI/status/check reported on the PR head commit (Jenkins, Actions, etc.). */
export type CiCheckItem = {
  id: string;
  name: string;
  state: CiStatus;
  description: string;
  targetUrl: string | null;
  source: "status" | "check_run";
  /** Optional ISO timestamp when known. */
  updatedAt: string | null;
};

export type CiChecksSnapshot = {
  overall: CiStatus;
  sha: string;
  items: CiCheckItem[];
  failedCount: number;
  pendingCount: number;
  successCount: number;
};

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type PullRequest = {
  id: number;
  number: number;
  repo: string;
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  author: { login: string; avatarUrl: string };
  isDraft: boolean;
  updatedAt: string;
  createdAt: string;
  /** Head branch name when known (from PR detail / enrich). */
  headBranch?: string;
  /**
   * Local review we submitted from IM Review (keeps PR visible after GitHub
   * drops it from review-requested).
   */
  localReviewEvent?: ReviewEvent;
  /** True when this row is kept from local history, not live GitHub search. */
  fromLocalReview?: boolean;
};

export type PrTab = "assigned" | "review" | "mine";

export type PrLists = Record<PrTab, PullRequest[]>;

export type PrDetail = PullRequest & {
  body: string;
  headSha: string;
  nodeId: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewers: string[];
  ciStatus: CiStatus;
  ciDescription: string;
};

/** Starred PR head branch (local). */
export type FavoriteBranch = {
  id: string; // `${repo}::${branch}`
  repo: string;
  branch: string;
  prNumber: number;
  title: string;
  url: string;
  favoritedAt: string;
};

/** Local copy of a review we submitted from the app. */
export type SavedReview = {
  id: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  branch?: string;
  event: ReviewEvent;
  summary: string;
  body: string;
  comments: Array<{ path: string; line: number; body: string }>;
  submittedAt: string;
};

/** Inline comment attached to a PR review. */
export type PrReviewComment = {
  id: number;
  path: string;
  line: number | null;
  body: string;
  user: string;
  avatarUrl: string;
  createdAt: string;
  htmlUrl: string;
  reviewId: number | null;
};

/** One submitted GitHub review (may include inline comments). */
export type PrReviewItem = {
  id: number;
  user: string;
  avatarUrl: string;
  state: string;
  body: string;
  submittedAt: string | null;
  htmlUrl: string;
  comments: PrReviewComment[];
};

export type PrReviewsSnapshot = {
  reviews: PrReviewItem[];
  /** Latest non-pending state per login. */
  latestByUser: Array<{
    user: string;
    avatarUrl: string;
    state: string;
  }>;
  inlineCount: number;
};

export function prKey(repo: string, number: number): string {
  return `${repo}#${number}`;
}

export function savedReviewToPullRequest(s: SavedReview): PullRequest {
  return {
    id: -Math.abs(s.prNumber + s.repo.length * 1000),
    number: s.prNumber,
    repo: s.repo,
    title: s.prTitle,
    url: s.prUrl,
    state: "open",
    author: { login: "you", avatarUrl: "" },
    isDraft: false,
    updatedAt: s.submittedAt,
    createdAt: s.submittedAt,
    headBranch: s.branch,
    localReviewEvent: s.event,
    fromLocalReview: true,
  };
}

/** Latest saved review per PR (repo#number). */
export function latestReviewsByPr(
  reviews: SavedReview[],
): Map<string, SavedReview> {
  const map = new Map<string, SavedReview>();
  for (const r of reviews) {
    const key = prKey(r.repo, r.prNumber);
    const prev = map.get(key);
    if (!prev || prev.submittedAt < r.submittedAt) map.set(key, r);
  }
  return map;
}
