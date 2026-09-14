import { describe, expect, it } from "vitest";

import {
  githubReviewStateLabel,
  githubReviewStateToEvent,
  reviewEventBadgeClass,
  reviewEventLabel,
} from "./review-status";

describe("review-status", () => {
  it("labels local review events", () => {
    expect(reviewEventLabel("APPROVE")).toBe("Already reviewed · Approved");
    expect(reviewEventLabel("REQUEST_CHANGES")).toBe(
      "Already reviewed · Changes requested",
    );
    expect(reviewEventLabel("COMMENT")).toBe("Already reviewed · Commented");
  });

  it("returns badge classes per event", () => {
    expect(reviewEventBadgeClass("APPROVE")).toContain("emerald");
    expect(reviewEventBadgeClass("REQUEST_CHANGES")).toContain("red");
    expect(reviewEventBadgeClass("COMMENT")).toContain("sky");
  });

  it("maps GitHub review states", () => {
    expect(githubReviewStateToEvent("APPROVED")).toBe("APPROVE");
    expect(githubReviewStateToEvent("CHANGES_REQUESTED")).toBe(
      "REQUEST_CHANGES",
    );
    expect(githubReviewStateToEvent("COMMENTED")).toBe("COMMENT");
    expect(githubReviewStateToEvent("DISMISSED")).toBeUndefined();
    expect(githubReviewStateLabel("DISMISSED")).toBe(
      "Already reviewed · Dismissed",
    );
    expect(githubReviewStateLabel("APPROVED")).toBe(
      "Already reviewed · Approved",
    );
  });
});
