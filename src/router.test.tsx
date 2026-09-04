import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    hasToken: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import { redirectIfAuthed, requireAuth } from "./router";

const mockHasToken = vi.mocked(api.hasToken);

function isRedirect(error: unknown, location: string): boolean {
  return (
    error instanceof Response &&
    error.status === 302 &&
    error.headers.get("Location") === location
  );
}

describe("router loaders", () => {
  it("requireAuth returns null when token exists", async () => {
    mockHasToken.mockResolvedValue(true);
    await expect(requireAuth()).resolves.toBeNull();
  });

  it("requireAuth redirects to onboarding when no token", async () => {
    mockHasToken.mockResolvedValue(false);
    await expect(requireAuth()).rejects.toSatisfy((error) =>
      isRedirect(error, "/onboarding"),
    );
  });

  it("redirectIfAuthed redirects home when token exists", async () => {
    mockHasToken.mockResolvedValue(true);
    await expect(redirectIfAuthed()).rejects.toSatisfy((error) =>
      isRedirect(error, "/"),
    );
  });

  it("redirectIfAuthed returns null when no token", async () => {
    mockHasToken.mockResolvedValue(false);
    await expect(redirectIfAuthed()).resolves.toBeNull();
  });
});
