import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import {
  DONE_REVIEW_BADGE,
  PENDING_REVIEW_BADGE,
  reviewEventLabel,
} from "./review-status";
import type { ReviewEvent } from "./types";

type Props = {
  event: ReviewEvent;
  className?: string;
  /** Short “Already reviewed” only (no approve/comment subtype). */
  compact?: boolean;
};

function badgeVariant(
  event: ReviewEvent,
): "success" | "error" | "warning" | "secondary" {
  switch (event) {
    case "APPROVE":
      return "success";
    case "REQUEST_CHANGES":
      return "error";
    default:
      return "secondary";
  }
}

export function ReviewStatusBadge({ event, className, compact }: Props) {
  return (
    <Badge
      data-testid="review-status-badge"
      variant={badgeVariant(event)}
      title={reviewEventLabel(event)}
      className={cn("gap-1 uppercase", className)}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      {compact ? DONE_REVIEW_BADGE : reviewEventLabel(event)}
    </Badge>
  );
}

export function NotReviewedBadge({ className }: { className?: string }) {
  return (
    <Badge
      data-testid="not-reviewed-badge"
      variant="accent"
      className={cn("uppercase", className)}
    >
      {PENDING_REVIEW_BADGE}
    </Badge>
  );
}

export function NeedsReviewBadge({ className }: { className?: string }) {
  return (
    <Badge
      data-testid="needs-review-badge"
      variant="github"
      className={cn("uppercase", className)}
    >
      Needs review
    </Badge>
  );
}
