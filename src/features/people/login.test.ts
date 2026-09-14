import { describe, expect, it } from "vitest";

import { normalizeGithubLogin, sameGithubLogin } from "./login";

describe("normalizeGithubLogin", () => {
  it("strips @ and validates", () => {
    expect(normalizeGithubLogin(" @alice ")).toBe("alice");
    expect(normalizeGithubLogin("Alice-Dev")).toBe("Alice-Dev");
    expect(normalizeGithubLogin("bad login")).toBeNull();
    expect(normalizeGithubLogin("@")).toBeNull();
    expect(normalizeGithubLogin("-nope")).toBeNull();
  });

  it("compares case-insensitively", () => {
    expect(sameGithubLogin("Alice", "alice")).toBe(true);
  });
});
