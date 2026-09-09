import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

import {
  clearPrCacheForTests,
  flattenPrCache,
  getPrCache,
  getPrCacheUpdatedAt,
  getPrTabUpdatedAt,
  reloadPrCacheFromStorage,
  setPrCache,
  setPrCacheTab,
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
  beforeEach(() => {
    clearPrCacheForTests();
  });

  it("round-trips and flattens with dedupe", () => {
    const shared = makePr({ repo: "acme/web", number: 1 });
    setPrCache({
      all: [],
      favorites: [],
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

  it("persists tab updates to localStorage and rehydrates timestamps", () => {
    const pr = makePr({ repo: "tiket/TIX-HOTEL-NEXT-FE", number: 1 });
    setPrCacheTab("favorites", [pr]);
    expect(getPrCache().favorites).toEqual([pr]);
    expect(getPrTabUpdatedAt("favorites")).toBeInstanceOf(Date);
    expect(getPrCacheUpdatedAt()).toBeInstanceOf(Date);

    const raw = localStorage.getItem("im-review:pr-lists-v1");
    expect(raw).toContain("TIX-HOTEL-NEXT-FE");
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsub = subscribePrCache(listener);
    setPrCache({
      all: [],
      assigned: [],
      review: [],
      mine: [],
      favorites: [],
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    setPrCache({
      all: [],
      favorites: [],
      assigned: [],
      review: [],
      mine: [makePr({ repo: "acme/web", number: 9 })],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("flattens empty", () => {
    expect(
      flattenPrCache({
        all: [],
        assigned: [],
        review: [],
        mine: [],
        favorites: [],
      }),
    ).toEqual([]);
  });

  it("reloadPrCacheFromStorage ignores corrupt / invalid shapes", () => {
    localStorage.setItem("im-review:pr-lists-v1", "{not-json");
    expect(reloadPrCacheFromStorage()).toEqual({
      all: [],
      favorites: [],
      assigned: [],
      review: [],
      mine: [],
    });

    localStorage.setItem(
      "im-review:pr-lists-v1",
      JSON.stringify({ lists: { all: [] }, updatedAt: 1 }),
    );
    expect(reloadPrCacheFromStorage().assigned).toEqual([]);

    localStorage.setItem(
      "im-review:pr-lists-v1",
      JSON.stringify({
        lists: {
          all: [],
          favorites: [makePr({ repo: "acme/web", number: 1 })],
          assigned: [],
          review: [],
          mine: [],
        },
        updatedAt: null,
        tabUpdatedAt: "bad",
      }),
    );
    const lists = reloadPrCacheFromStorage();
    expect(lists.favorites).toHaveLength(1);
    expect(getPrCacheUpdatedAt()).toBeNull();
    expect(getPrTabUpdatedAt("favorites")).toBeNull();
  });

  it("writePersisted swallows quota errors", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(() =>
      setPrCacheTab("mine", [makePr({ repo: "acme/web", number: 4 })]),
    ).not.toThrow();
    expect(getPrCache().mine).toHaveLength(1);
    spy.mockRestore();
  });

  it("clearPrCacheForTests swallows removeItem errors", () => {
    setPrCacheTab("all", [makePr({ repo: "acme/web", number: 8 })]);
    const spy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(() => clearPrCacheForTests()).not.toThrow();
    expect(getPrCache().all).toEqual([]);
    spy.mockRestore();
  });
});
