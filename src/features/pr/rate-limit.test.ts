import { describe, expect, it } from "vitest";

import { isGithubRateLimitError, rateLimitUserMessage } from "./rate-limit";

describe("rate-limit helpers", () => {
  it("detects secondary / rate limit / github 403", () => {
    expect(
      isGithubRateLimitError(
        new Error("You have exceeded a secondary rate limit"),
      ),
    ).toBe(true);
    expect(isGithubRateLimitError("api rate limit exceeded")).toBe(true);
    expect(isGithubRateLimitError("github error 403: nope")).toBe(true);
    expect(isGithubRateLimitError("network down")).toBe(false);
  });

  it("maps rate-limit errors to user message", () => {
    expect(rateLimitUserMessage(new Error("rate limit"))).toMatch(
      /rate limit/i,
    );
    expect(rateLimitUserMessage(new Error("boom"))).toBe("Error: boom");
  });
});
