import { describe, expect, it, vi } from "vitest";

import {
  hasGoogleOAuthClientSecret,
  isGoogleOAuthPairConfigured,
  isValidGoogleOAuthClientId,
} from "./google-oauth";

describe("UNIT-GOOGLE-001..003 google-oauth config helpers", () => {
  it("UNIT-GOOGLE-001 accepts Desktop client ids", () => {
    expect(
      isValidGoogleOAuthClientId("941915445886-abc.apps.googleusercontent.com"),
    ).toBe(true);
    expect(isValidGoogleOAuthClientId("  x.apps.googleusercontent.com  ")).toBe(
      true,
    );
    expect(isValidGoogleOAuthClientId("not-a-client")).toBe(false);
    expect(isValidGoogleOAuthClientId("")).toBe(false);
  });

  it("UNIT-GOOGLE-002/003 requires id + non-empty secret", () => {
    const id = "desktop.apps.googleusercontent.com";
    expect(isGoogleOAuthPairConfigured(id, "GOCSPX-secret")).toBe(true);
    expect(isGoogleOAuthPairConfigured(id, "")).toBe(false);
    expect(isGoogleOAuthPairConfigured(id, "   ")).toBe(false);
    expect(isGoogleOAuthPairConfigured("bad", "GOCSPX-secret")).toBe(false);
    expect(hasGoogleOAuthClientSecret("x")).toBe(true);
    expect(hasGoogleOAuthClientSecret(" \t ")).toBe(false);
  });

  it("UNIT-GOOGLE-004 isGoogleOAuthConfigured reads env pair", async () => {
    vi.stubEnv(
      "VITE_GOOGLE_OAUTH_CLIENT_ID",
      "941915445886-abc.apps.googleusercontent.com",
    );
    vi.stubEnv("VITE_GOOGLE_OAUTH_CLIENT_SECRET", "GOCSPX-secret");
    vi.resetModules();
    const mod = await import("./google-oauth");
    expect(mod.isGoogleOAuthConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
