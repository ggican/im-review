import type { ReviewEvent } from "./types";

/** Short “done” badge — clear that you already handled this PR. */
export const DONE_REVIEW_BADGE = "Already reviewed";

/** Pending badge when there is no local/GitHub review from you. */
export const PENDING_REVIEW_BADGE = "Needs review";

/** Human label for a local IM Review submit event. */
export function reviewEventLabel(event: ReviewEvent): string {
  switch (event) {
    case "APPROVE":
      return `${DONE_REVIEW_BADGE} · Approved`;
    case "REQUEST_CHANGES":
      return `${DONE_REVIEW_BADGE} · Changes requested`;
    default:
      return `${DONE_REVIEW_BADGE} · Commented`;
  }
}

/** Tailwind classes for a local review-event badge. */
export function reviewEventBadgeClass(event: ReviewEvent): string {
  switch (event) {
    case "APPROVE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "REQUEST_CHANGES":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default:
      return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  }
}

/** Map GitHub review state → local ReviewEvent when possible. */
export function githubReviewStateToEvent(
  state: string,
): ReviewEvent | undefined {
  switch (state) {
    case "APPROVED":
      return "APPROVE";
    case "CHANGES_REQUESTED":
      return "REQUEST_CHANGES";
    case "COMMENTED":
      return "COMMENT";
    default:
      return undefined;
  }
}

export function githubReviewStateLabel(state: string): string {
  const event = githubReviewStateToEvent(state);
  if (event) return reviewEventLabel(event);
  switch (state) {
    case "DISMISSED":
      return `${DONE_REVIEW_BADGE} · Dismissed`;
    case "PENDING":
      return "Review pending";
    default:
      return `${DONE_REVIEW_BADGE} · ${state}`;
  }
}
