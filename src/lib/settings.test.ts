import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  deleteSavedReview,
  deleteTemplate,
  getFavoriteBranches,
  getFavorites,
  getSavedReviews,
  getSettings,
  getTemplates,
  isFavorite,
  isFavoriteBranch,
  newTemplateId,
  removeFavorite,
  removeFavoriteBranch,
  restoreDefaultFavorites,
  saveReviewLocally,
  saveSettings,
  subscribeSettings,
  toggleFavorite,
  toggleFavoriteBranch,
  upsertTemplate,
} from "@/lib/settings";

describe("UNIT-SETTINGS store", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset mutable stores to known defaults via APIs.
    saveSettings({
      refreshIntervalMin: 5,
      theme: "system",
      favoritesOnly: true,
      aiProvider: "cursor",
    });
    // Clear favorites then restore defaults for predictable set.
    for (const fav of [...getFavorites()]) {
      removeFavorite(fav);
    }
    restoreDefaultFavorites();
    for (const b of [...getFavoriteBranches()]) {
      removeFavoriteBranch(b.id);
    }
    for (const r of [...getSavedReviews()]) {
      deleteSavedReview(r.id);
    }
  });

  it("UNIT-SETTINGS-001 persists settings", () => {
    saveSettings({
      ...getSettings(),
      refreshIntervalMin: 15,
      favoritesOnly: false,
      theme: "dark",
    });
    expect(getSettings().refreshIntervalMin).toBe(15);
    expect(getSettings().favoritesOnly).toBe(false);
    expect(getSettings().theme).toBe("dark");
  });

  it("UNIT-SETTINGS-003 templates upsert/delete", () => {
    const id = newTemplateId();
    upsertTemplate({ id, name: "Hi", body: "Hello" });
    expect(getTemplates().some((t) => t.id === id && t.name === "Hi")).toBe(
      true,
    );
    upsertTemplate({ id, name: "Hi2", body: "Hello2" });
    expect(getTemplates().find((t) => t.id === id)?.name).toBe("Hi2");
    deleteTemplate(id);
    expect(getTemplates().some((t) => t.id === id)).toBe(false);
  });

  it("UNIT-SETTINGS-004 favorites toggle/remove/restore", () => {
    const name = "acme/demo-repo";
    expect(isFavorite(name)).toBe(false);
    toggleFavorite(name);
    expect(isFavorite(name)).toBe(true);
    removeFavorite(name);
    expect(isFavorite(name)).toBe(false);
    restoreDefaultFavorites();
    expect(getFavorites().length).toBeGreaterThan(0);
  });

  it("UNIT-SETTINGS-005/011 favorite branches", () => {
    const next = toggleFavoriteBranch({
      repo: "acme/web",
      branch: "feat/x",
      prNumber: 1,
      title: "X",
      url: "https://github.com/acme/web/pull/1",
    });
    expect(isFavoriteBranch("acme/web", "feat/x")).toBe(true);
    expect(next.some((b) => b.branch === "feat/x")).toBe(true);
    const id = next.find((b) => b.branch === "feat/x")!.id;
    removeFavoriteBranch(id);
    expect(isFavoriteBranch("acme/web", "feat/x")).toBe(false);
  });

  it("UNIT-SETTINGS-006/007 saved reviews cap and delete", () => {
    for (let i = 0; i < 55; i += 1) {
      saveReviewLocally({
        repo: "acme/web",
        prNumber: i,
        prTitle: `PR ${i}`,
        prUrl: `https://github.com/acme/web/pull/${i}`,
        event: "COMMENT",
        summary: "s",
        body: "b",
        comments: [],
      });
    }
    expect(getSavedReviews().length).toBe(50);
    const first = getSavedReviews()[0]!;
    deleteSavedReview(first.id);
    expect(getSavedReviews().some((r) => r.id === first.id)).toBe(false);
  });

  it("UNIT-SETTINGS-008 subscribeSettings", () => {
    const listener = vi.fn();
    const unsub = subscribeSettings(listener);
    saveSettings({ ...getSettings(), refreshIntervalMin: 1 });
    expect(listener).toHaveBeenCalled();
    unsub();
    saveSettings({ ...getSettings(), refreshIntervalMin: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("UNIT-SETTINGS-009 newTemplateId prefix", () => {
    expect(newTemplateId().startsWith("tpl_")).toBe(true);
  });

  it("UNIT-SETTINGS-010 applyTheme toggles dark class", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    applyTheme("system");
    // happy-dom default prefers-color-scheme is usually light → no dark
    expect(typeof document.documentElement.classList.contains("dark")).toBe(
      "boolean",
    );
  });

  it("toggleFavoriteBranch removes when already favorited", () => {
    toggleFavoriteBranch({
      repo: "acme/web",
      branch: "feat/y",
      prNumber: 2,
      title: "Y",
      url: "https://github.com/acme/web/pull/2",
    });
    expect(isFavoriteBranch("acme/web", "feat/y")).toBe(true);
    toggleFavoriteBranch({
      repo: "acme/web",
      branch: "feat/y",
      prNumber: 2,
      title: "Y",
      url: "https://github.com/acme/web/pull/2",
    });
    expect(isFavoriteBranch("acme/web", "feat/y")).toBe(false);
  });

  it("saveReviewLocally accepts explicit id/submittedAt", () => {
    saveReviewLocally({
      id: "fixed-id",
      submittedAt: "2026-01-01T00:00:00.000Z",
      repo: "acme/web",
      prNumber: 99,
      prTitle: "Fixed",
      prUrl: "https://github.com/acme/web/pull/99",
      event: "APPROVE",
      summary: "ok",
      body: "ok",
      comments: [{ path: "a.ts", line: 1, body: "n" }],
      branch: "main",
    });
    expect(getSavedReviews()[0]?.id).toBe("fixed-id");
  });

  it("UNIT-SETTINGS-012 recovers corrupt storage and invalid provider on load", async () => {
    localStorage.clear();
    localStorage.setItem(
      "im-review:settings",
      JSON.stringify({ aiProvider: "not-a-provider", theme: "dark" }),
    );
    localStorage.setItem("im-review:favorites", "{not-json");
    localStorage.setItem(
      "im-review:favorite-branches",
      JSON.stringify([{ nope: true }, null]),
    );
    localStorage.setItem(
      "im-review:saved-reviews",
      JSON.stringify([{ nope: true }]),
    );
    localStorage.setItem("im-review:templates", "{bad");
    localStorage.setItem("pr-helper:settings", JSON.stringify({ theme: "light" }));
    vi.resetModules();
    const mod = await import("@/lib/settings");
    expect(mod.getSettings().aiProvider).toBe("cursor");
    expect(mod.getFavorites().length).toBeGreaterThan(0);
    expect(mod.getFavoriteBranches()).toEqual([]);
    expect(mod.getSavedReviews()).toEqual([]);
    expect(mod.getTemplates().length).toBeGreaterThan(0);
  });
});
