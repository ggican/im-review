import { beforeEach, describe, expect, it, vi } from "vitest";

import { cn } from "@/lib/cn";
import {
  clearAiKey,
  clearGithubToken,
  getAiKey,
  getGithubToken,
  hasAiKeyLocal,
  hasGithubToken,
  listAiKeysLocal,
  secretsHydratePayload,
  setAiKey,
  setGithubToken,
} from "@/lib/secrets";
import {
  countNewPrs,
  ensureLastSeenSeeded,
  getLastSeenAt,
  getLastSeenSnapshot,
  isPrNew,
  markAllSeen,
  subscribeLastSeen,
} from "@/lib/seen";
import { relativeTime } from "@/lib/time";

describe("UNIT-LIB-001..006 seen", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset by marking a known value after clear — seed writes fresh.
    markAllSeen("2026-01-01T00:00:00.000Z");
  });

  it("seeds idempotently after clear via markAllSeen baseline", () => {
    localStorage.clear();
    // Module cache may still hold previous; markAllSeen updates both.
    const a = markAllSeen("2026-06-01T00:00:00.000Z");
    expect(getLastSeenAt()).toBe(a);
    expect(ensureLastSeenSeeded()).toBe(a);
    expect(getLastSeenSnapshot()).toBe(a);
  });

  it("detects new PRs and counts", () => {
    const watermark = "2026-06-01T00:00:00.000Z";
    markAllSeen(watermark);
    const older = {
      updatedAt: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-05-01T00:00:00.000Z",
    };
    const newer = {
      updatedAt: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-07-01T00:00:00.000Z",
    };
    expect(isPrNew(older)).toBe(false);
    expect(isPrNew(newer)).toBe(true);
    expect(countNewPrs([older, newer])).toBe(1);
  });

  it("treats invalid dates / watermark as not new", () => {
    expect(
      isPrNew(
        { updatedAt: "nope", createdAt: "nope" },
        "2026-06-01T00:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      isPrNew(
        {
          updatedAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        "not-a-date",
      ),
    ).toBe(false);
    expect(
      isPrNew(
        {
          updatedAt: "2026-07-01T00:00:00.000Z",
          createdAt: "2026-07-01T00:00:00.000Z",
        },
        null,
      ),
    ).toBe(false);
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    const unsub = subscribeLastSeen(listener);
    markAllSeen("2026-08-01T00:00:00.000Z");
    expect(listener).toHaveBeenCalled();
    unsub();
    markAllSeen("2026-09-01T00:00:00.000Z");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("UNIT-LIB-007..010 secrets", () => {
  beforeEach(() => {
    localStorage.clear();
    clearGithubToken();
    clearAiKey("openai");
    clearAiKey("cursor");
  });

  it("stores github and ai keys", () => {
    expect(hasGithubToken()).toBe(false);
    setGithubToken("  ghp_test  ");
    expect(getGithubToken()).toBe("ghp_test");
    expect(hasGithubToken()).toBe(true);

    setAiKey("openai", "sk-test");
    expect(getAiKey("openai")).toBe("sk-test");
    expect(hasAiKeyLocal("openai")).toBe(true);
    expect(listAiKeysLocal().openai).toBe("sk-test");

    const payload = secretsHydratePayload();
    expect(payload.githubToken).toBe("ghp_test");
    expect(payload.aiKeys.openai).toBe("sk-test");

    clearAiKey("openai");
    clearGithubToken();
    expect(getGithubToken()).toBeNull();
    expect(getAiKey("openai")).toBeNull();
  });

  it("treats whitespace as absent", () => {
    setGithubToken("   ");
    expect(getGithubToken()).toBeNull();
  });
});

describe("UNIT-LIB-011/012 relativeTime", () => {
  const now = Date.parse("2026-09-04T12:00:00.000Z");

  it("formats buckets including months", () => {
    expect(relativeTime("2026-09-04T11:59:30.000Z", now)).toBe("just now");
    expect(relativeTime("2026-09-04T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-09-04T08:00:00.000Z", now)).toBe("4h ago");
    expect(relativeTime("2026-09-02T12:00:00.000Z", now)).toBe("2d ago");
    expect(relativeTime("2026-01-04T12:00:00.000Z", now)).toMatch(/mo ago/);
  });

  it("returns empty for invalid", () => {
    expect(relativeTime("not-a-date", now)).toBe("");
  });
});

describe("UNIT-LIB-013/014 cn", () => {
  it("merges and ignores falsy", () => {
    const hidden = false;
    expect(cn("px-2", hidden && "hidden", "px-4")).toBe("px-4");
  });
});
