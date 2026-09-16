import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  NeedsReviewBadge,
  NotReviewedBadge,
  ReviewStatusBadge,
} from "./ReviewStatusBadge";

describe("ReviewStatusBadge", () => {
  it("renders event labels and compact mode", () => {
    const { rerender } = render(<ReviewStatusBadge event="APPROVE" />);
    expect(screen.getByTestId("review-status-badge")).toHaveTextContent(
      /approve/i,
    );

    rerender(<ReviewStatusBadge event="REQUEST_CHANGES" />);
    expect(screen.getByTestId("review-status-badge")).toBeInTheDocument();

    rerender(<ReviewStatusBadge event="COMMENT" compact />);
    expect(screen.getByTestId("review-status-badge")).toBeInTheDocument();
  });

  it("renders not-reviewed and needs-review badges", () => {
    render(
      <>
        <NotReviewedBadge />
        <NeedsReviewBadge />
      </>,
    );
    expect(screen.getByTestId("not-reviewed-badge")).toBeInTheDocument();
    expect(screen.getByTestId("needs-review-badge")).toBeInTheDocument();
  });
});
