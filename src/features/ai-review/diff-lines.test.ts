import { describe, expect, it } from "vitest";

import {
  normalizeReviewPath,
  rightSideLinesFromPatch,
  snapToCommentableLine,
} from "./diff-lines";

describe("UNIT-AIREVIEW-001/002/003 rightSideLinesFromPatch", () => {
  it("parses added and context lines", () => {
    const patch = [
      "@@ -1,3 +1,4 @@",
      " line1",
      "-old",
      "+new",
      " line3",
      "+extra",
    ].join("\n");
    expect(rightSideLinesFromPatch(patch)).toEqual([1, 2, 3, 4]);
  });

  it("handles multiple hunks", () => {
    const patch = [
      "@@ -10,1 +10,1 @@",
      " keep",
      "@@ -20,0 +21,1 @@",
      "+add",
    ].join("\n");
    expect(rightSideLinesFromPatch(patch)).toEqual([10, 21]);
  });

  it("skips minus lines and no-newline markers", () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      "-gone",
      "+here",
      "\\ No newline at end of file",
      " keep",
    ].join("\n");
    expect(rightSideLinesFromPatch(patch)).toEqual([1, 2]);
  });
});

describe("UNIT-AIREVIEW-004 snapToCommentableLine", () => {
  it("exact / nearest / far / empty", () => {
    expect(snapToCommentableLine(5, [1, 5, 9])).toBe(5);
    expect(snapToCommentableLine(7, [1, 5, 9], 3)).toBe(5);
    expect(snapToCommentableLine(100, [1, 2, 3], 5)).toBeNull();
    expect(snapToCommentableLine(1, [])).toBeNull();
  });
});

describe("UNIT-AIREVIEW-005 normalizeReviewPath", () => {
  it("trims and normalizes separators", () => {
    expect(normalizeReviewPath(" ./src\\foo.ts ")).toBe("src/foo.ts");
  });
});
