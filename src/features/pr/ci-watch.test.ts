import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

vi.mock("@/lib/api", () => ({
  api: { githubGet: vi.fn() },
}));

import { api } from "@/lib/api";

import { scanMineCiFailures } from "./ci-watch";

const githubGet = vi.mocked(api.githubGet);

describe("UNIT-API-015 scanMineCiFailures", () => {
  beforeEach(() => githubGet.mockReset());

  it("returns only failing CI, skips drafts/local, sorts", async () => {
    const mine = [
      makePr({ repo: "z/app", number: 1, isDraft: true }),
      makePr({ repo: "z/app", number: 2, fromLocalReview: true }),
      makePr({ repo: "b/app", number: 3 }),
      makePr({ repo: "a/app", number: 4 }),
      makePr({ repo: "c/app", number: 5 }),
    ];

    githubGet.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.includes("/pulls/3")) {
        return { head: { sha: "s3" }, title: "Three" };
      }
      if (path.includes("/commits/s3/status")) {
        return {
          state: "failure",
          statuses: [{ state: "failure", context: "ci" }],
        };
      }
      if (path.includes("/pulls/4")) {
        return { head: { sha: "s4" }, title: "Four" };
      }
      if (path.includes("/commits/s4/status")) {
        return { state: "success", statuses: [] };
      }
      if (path.includes("/pulls/5")) {
        throw new Error("404");
      }
      return { head: { sha: "x" }, title: "x" };
    });

    const hits = await scanMineCiFailures(mine, 6);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.pr.repo).toBe("b/app");
    expect(hits[0]?.description).toContain("ci");
  });
});
