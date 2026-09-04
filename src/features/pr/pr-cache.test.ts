import { describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

import {
  flattenPrCache,
  getPrCache,
  setPrCache,
  subscribePrCache,
} from "./pr-cache";
import {
  latestReviewsByPr,
  prKey,
  type SavedReview,
  savedReviewToPullRequest,
} from "./types";

describe("UNIT-PR-001..004 types helpers", () => {
  it("keys and maps saved reviews", () => {
    expect(prKey("acme/web", 3)).toBe("acme/web#3");
    const saved: SavedReview = {
      id: "r1",
      repo: "acme/web",
      prNumber: 3,
      prTitle: "Hello",
      prUrl: "https://github.com/acme/web/pull/3",
      branch: "feat/x",
      event: "APPROVE",
      summary: "LGTM",
      body: "LGTM",
      comments: [],
      submittedAt: "2026-09-01T00:00:00.000Z",
    };
    const asPr = savedReviewToPullRequest(saved);
    expect(asPr.localReviewEvent).toBe("APPROVE");
    expect(asPr.fromLocalReview).toBe(true);
    expect(asPr.headBranch).toBe("feat/x");

    const map = latestReviewsByPr([
      saved,
      {
        ...saved,
        id: "r2",
        submittedAt: "2026-09-02T00:00:00.000Z",
        event: "COMMENT",
      },
      {
        ...saved,
        id: "r0",
        submittedAt: "2026-08-01T00:00:00.000Z",
        event: "REQUEST_CHANGES",
      },
    ]);
    expect(map.get("acme/web#3")?.event).toBe("COMMENT");
  });
});

describe("UNIT-PR-005..008 pr-cache", () => {
  it("round-trips and flattens with dedupe", () => {
    const shared = makePr({ repo: "acme/web", number: 1 });
    setPrCache({
      assigned: [shared],
      review: [shared, makePr({ repo: "acme/api", number: 2 })],
      mine: [makePr({ repo: "acme/web", number: 3 })],
    });
    expect(getPrCache().mine).toHaveLength(1);
    const flat = flattenPrCache();
    expect(flat.map((p) => `${p.repo}#${p.number}`)).toEqual([
      "acme/web#1",
      "acme/api#2",
      "acme/web#3",
    ]);
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsub = subscribePrCache(listener);
    setPrCache({ assigned: [], review: [], mine: [] });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    setPrCache({
      assigned: [],
      review: [],
      mine: [makePr({ repo: "acme/web", number: 9 })],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("flattens empty", () => {
    expect(flattenPrCache({ assigned: [], review: [], mine: [] })).toEqual([]);
  });
});
