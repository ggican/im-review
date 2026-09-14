import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/cn";

import {
  DONE_REVIEW_BADGE,
  PENDING_REVIEW_BADGE,
  reviewEventBadgeClass,
  reviewEventLabel,
} from "./review-status";
import type { ReviewEvent } from "./types";

type Props = {
  event: ReviewEvent;
  className?: string;
  /** Short “Already reviewed” only (no approve/comment subtype). */
  compact?: boolean;
};

export function ReviewStatusBadge({ event, className, compact }: Props) {
  return (
    <span
      data-testid="review-status-badge"
      title={reviewEventLabel(event)}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase",
        reviewEventBadgeClass(event),
        className,
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      {compact ? DONE_REVIEW_BADGE : reviewEventLabel(event)}
    </span>
  );
}

export function NotReviewedBadge({ className }: { className?: string }) {
  return (
    <span
      data-testid="not-reviewed-badge"
      className={cn(
        "rounded-sm bg-neutral-100 px-1.5 py-0.5 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:bg-neutral-900 dark:text-neutral-400",
        className,
      )}
    >
      {PENDING_REVIEW_BADGE}
    </span>
  );
}
