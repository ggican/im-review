import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

import { api, hydrateRuntimeSecrets } from "./api";
import {
  clearAiKey,
  clearGithubToken,
  setAiKey,
  setGithubToken,
} from "./secrets";

describe("UNIT-API lib/api", () => {
  beforeEach(() => {
    localStorage.clear();
    clearGithubToken();
    clearAiKey("cursor");
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
  });

  it("UNIT-API-001 hydrateRuntimeSecrets", async () => {
    setGithubToken("ghp_x");
    setAiKey("cursor", "ck_1");
    await hydrateRuntimeSecrets();
    expect(invoke).toHaveBeenCalledWith("hydrate_runtime_secrets", {
      githubToken: "ghp_x",
      aiKeys: expect.objectContaining({ cursor: "ck_1" }),
    });
  });

  it("UNIT-API-002 token save/has/delete", async () => {
    await api.saveToken("  tok  ");
    expect(await api.hasToken()).toBe(true);
    await api.deleteToken();
    expect(await api.hasToken()).toBe(false);
  });

  it("UNIT-API-003/004 AI keys + cursor wrappers", async () => {
    await api.saveAiKey("cursor", "k1");
    expect(await api.hasAiKey("cursor")).toBe(true);
    const status = await api.listAiProviderStatus();
    expect(status.find((s) => s.id === "cursor")?.has_key).toBe(true);
    invoke.mockResolvedValueOnce({ ok: true });
    await api.validateAiKey("cursor");
    expect(invoke).toHaveBeenCalledWith(
      "validate_ai_key",
      expect.objectContaining({ provider: "cursor" }),
    );
    await api.saveCursorKey("k2");
    expect(await api.hasCursorKey()).toBe(true);
    await api.deleteCursorKey();
    expect(await api.hasAiKey("cursor")).toBe(false);
  });

  it("UNIT-API-005 github + ai invoke helpers", async () => {
    invoke.mockResolvedValueOnce({ login: "alice" });
    await expect(api.validateToken("t")).resolves.toEqual({ login: "alice" });
    invoke.mockResolvedValueOnce([]);
    await api.githubGet("/x");
    invoke.mockResolvedValueOnce({});
    await api.githubRequest("POST", "/y", { a: 1 });
    invoke.mockResolvedValueOnce("draft");
    await api.aiReviewPr({
      provider: "cursor",
      prTitle: "T",
      prNumber: 1,
      prUrl: "u",
      patchContext: "p",
    });
    invoke.mockResolvedValueOnce("refined");
    await api.aiRefineReview({
      provider: "cursor",
      currentDraftJson: "{}",
      instruction: "fix",
    });
    invoke.mockResolvedValueOnce("c");
    await api.cursorReviewPr({
      prTitle: "T",
      prNumber: 1,
      prUrl: "u",
      patchContext: "p",
    });
    invoke.mockResolvedValueOnce("r");
    await api.cursorRefineReview({
      currentDraftJson: "{}",
      instruction: "x",
    });
    expect(invoke).toHaveBeenCalled();
  });
});
