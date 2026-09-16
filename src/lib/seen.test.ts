import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

describe("seen", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("migrates legacy last-seen key on module load", async () => {
    localStorage.setItem("pr-helper:last-seen-at", "2020-01-01T00:00:00.000Z");
    const { getLastSeenAt } = await import("./seen");
    expect(getLastSeenAt()).toBe("2020-01-01T00:00:00.000Z");
    expect(localStorage.getItem("im-review:last-seen-at")).toBe(
      "2020-01-01T00:00:00.000Z",
    );
    expect(localStorage.getItem("pr-helper:last-seen-at")).toBeNull();
  });

  it("seeds, marks seen, and counts new PRs", async () => {
    const {
      ensureLastSeenSeeded,
      getLastSeenAt,
      isPrNew,
      countNewPrs,
      markAllSeen,
      subscribeLastSeen,
    } = await import("./seen");

    const seeded = ensureLastSeenSeeded();
    expect(getLastSeenAt()).toBe(seeded);

    const listener = vi.fn();
    const unsubscribe = subscribeLastSeen(listener);
    markAllSeen("2026-09-01T00:00:00.000Z");
    expect(listener).toHaveBeenCalled();
    unsubscribe();

    const oldPr = makePr({
      number: 1,
      repo: "acme/app",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    const newPr = makePr({
      number: 2,
      repo: "acme/app",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    expect(isPrNew(oldPr)).toBe(false);
    expect(isPrNew(newPr)).toBe(true);
    expect(countNewPrs([oldPr, newPr])).toBe(1);
    expect(isPrNew(newPr, "not-a-date")).toBe(false);
  });
});
