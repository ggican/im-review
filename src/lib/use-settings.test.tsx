import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteSavedReview,
  deleteTemplate,
  getFavoriteBranches,
  getFavorites,
  getSavedReviews,
  getSettings,
  getTemplates,
  newTemplateId,
  removeFavorite,
  removeFavoriteBranch,
  saveReviewLocally,
  saveSettings,
  toggleFavorite,
  toggleFavoriteBranch,
  upsertTemplate,
} from "@/lib/settings";
import {
  useFavoriteBranches,
  useFavorites,
  useSavedReviews,
  useSettings,
  useTemplates,
} from "@/lib/use-settings";

function resetSettingsStore() {
  saveSettings({
    refreshIntervalMin: 5,
    theme: "system",
    favoritesOnly: true,
    aiProvider: "cursor",
  });
  for (const fav of [...getFavorites()]) {
    removeFavorite(fav);
  }
  for (const b of [...getFavoriteBranches()]) {
    removeFavoriteBranch(b.id);
  }
  for (const t of [...getTemplates()]) {
    if (!["lgtm", "rebase", "nits"].includes(t.id)) {
      deleteTemplate(t.id);
    }
  }
  for (const r of [...getSavedReviews()]) {
    deleteSavedReview(r.id);
  }
}

describe("useSettings hooks", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsStore();
  });

  it("useSettings reflects saveSettings", () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.refreshIntervalMin).toBe(5);

    act(() => {
      saveSettings({ ...getSettings(), refreshIntervalMin: 12, theme: "dark" });
    });

    expect(result.current.refreshIntervalMin).toBe(12);
    expect(result.current.theme).toBe("dark");
  });

  it("useTemplates reflects upsert and delete", () => {
    const { result } = renderHook(() => useTemplates());
    const before = result.current.length;
    const id = newTemplateId();

    act(() => {
      upsertTemplate({ id, name: "Ship it", body: "Ready to merge." });
    });
    expect(result.current.some((t) => t.id === id && t.name === "Ship it")).toBe(
      true,
    );

    act(() => {
      deleteTemplate(id);
    });
    expect(result.current).toHaveLength(before);
    expect(result.current.some((t) => t.id === id)).toBe(false);
  });

  it("useFavorites reflects toggle and remove", () => {
    const { result } = renderHook(() => useFavorites());
    const repo = "acme/hook-test";

    act(() => {
      toggleFavorite(repo);
    });
    expect(result.current).toContain(repo);

    act(() => {
      removeFavorite(repo);
    });
    expect(result.current).not.toContain(repo);
  });

  it("useFavoriteBranches reflects toggle and remove", () => {
    const { result } = renderHook(() => useFavoriteBranches());
    const branch = {
      repo: "acme/web",
      branch: "feat/hooks",
      prNumber: 42,
      title: "Hook test",
      url: "https://github.com/acme/web/pull/42",
    };

    act(() => {
      toggleFavoriteBranch(branch);
    });
    expect(
      result.current.some(
        (b) => b.repo === branch.repo && b.branch === branch.branch,
      ),
    ).toBe(true);

    const id = result.current.find((b) => b.branch === branch.branch)!.id;
    act(() => {
      removeFavoriteBranch(id);
    });
    expect(
      result.current.some(
        (b) => b.repo === branch.repo && b.branch === branch.branch,
      ),
    ).toBe(false);
  });

  it("useSavedReviews reflects save and delete", () => {
    const { result } = renderHook(() => useSavedReviews());

    act(() => {
      saveReviewLocally({
        id: "review-hook-1",
        submittedAt: "2026-09-01T00:00:00.000Z",
        repo: "acme/web",
        prNumber: 7,
        prTitle: "Saved review",
        prUrl: "https://github.com/acme/web/pull/7",
        event: "COMMENT",
        summary: "Looks good",
        body: "LGTM",
        comments: [],
      });
    });
    expect(result.current.some((r) => r.id === "review-hook-1")).toBe(true);

    act(() => {
      deleteSavedReview("review-hook-1");
    });
    expect(result.current.some((r) => r.id === "review-hook-1")).toBe(false);
  });
});
