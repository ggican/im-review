import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSettings, saveSettings } from "@/lib/settings";
import { makePr } from "@/test/fixtures";

vi.mock("./api", () => ({
  fetchAllOpenPrs: vi.fn(),
  fetchAssignedPrs: vi.fn(),
  fetchReviewRequestedPrs: vi.fn(),
  fetchMyOpenPrs: vi.fn(),
  fetchOpenPullsForRepos: vi.fn(),
}));

import {
  fetchAllOpenPrs,
  fetchAssignedPrs,
  fetchMyOpenPrs,
  fetchOpenPullsForRepos,
  fetchReviewRequestedPrs,
} from "./api";
import { useMyPRs } from "./hooks";
import { clearPrCacheForTests, setPrCacheTab } from "./pr-cache";

const mockAll = vi.mocked(fetchAllOpenPrs);
const mockAssigned = vi.mocked(fetchAssignedPrs);
const mockReview = vi.mocked(fetchReviewRequestedPrs);
const mockMine = vi.mocked(fetchMyOpenPrs);
const mockFavorites = vi.mocked(fetchOpenPullsForRepos);

const favorites = [makePr({ repo: "tiket/TIX-HOTEL-NEXT-FE", number: 9 })];
const assigned = [makePr({ repo: "acme/a", number: 1 })];

describe("useMyPRs", () => {
  beforeEach(() => {
    clearPrCacheForTests();
    saveSettings({ ...getSettings(), refreshIntervalMin: 0 });
    mockAll.mockReset();
    mockAssigned.mockReset();
    mockReview.mockReset();
    mockMine.mockReset();
    mockFavorites.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lazy-loads only the active tab", async () => {
    mockFavorites.mockResolvedValue(favorites);

    const { result } = renderHook(() => useMyPRs(true, "favorites"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists.favorites).toEqual(favorites);
    expect(result.current.stale).toBe(false);
    expect(mockFavorites).toHaveBeenCalledTimes(1);
    expect(mockAll).not.toHaveBeenCalled();
    expect(mockAssigned).not.toHaveBeenCalled();
  });

  it("keeps cached list when GitHub rate-limits", async () => {
    setPrCacheTab("favorites", favorites);
    mockFavorites.mockRejectedValue(
      new Error(
        'github error 403: { "message": "You have exceeded a secondary rate limit." }',
      ),
    );

    const { result } = renderHook(() => useMyPRs(true, "favorites"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists.favorites).toEqual(favorites);
    expect(result.current.stale).toBe(true);
    expect(result.current.error).toMatch(/list tersimpan/i);
  });

  it("loads assigned when that tab is active", async () => {
    mockAssigned.mockResolvedValue(assigned);

    const { result } = renderHook(() => useMyPRs(true, "assigned"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists.assigned).toEqual(assigned);
    expect(mockAssigned).toHaveBeenCalledTimes(1);
    expect(mockFavorites).not.toHaveBeenCalled();
  });

  it("loads all / review / mine tabs", async () => {
    const all = [makePr({ repo: "acme/all", number: 1 })];
    const review = [makePr({ repo: "acme/rev", number: 2 })];
    const mine = [makePr({ repo: "acme/me", number: 3 })];
    mockAll.mockResolvedValue(all);
    mockReview.mockResolvedValue(review);
    mockMine.mockResolvedValue(mine);

    const { result: allResult } = renderHook(() => useMyPRs(true, "all"));
    await waitFor(() => expect(allResult.current.loading).toBe(false));
    expect(allResult.current.lists.all).toEqual(all);

    const { result: reviewResult } = renderHook(() => useMyPRs(true, "review"));
    await waitFor(() => expect(reviewResult.current.loading).toBe(false));
    expect(reviewResult.current.lists.review).toEqual(review);

    const { result: mineResult } = renderHook(() => useMyPRs(true, "mine"));
    await waitFor(() => expect(mineResult.current.loading).toBe(false));
    expect(mineResult.current.lists.mine).toEqual(mine);
  });

  it("keeps cache on non-rate-limit errors", async () => {
    setPrCacheTab("favorites", favorites);
    mockFavorites.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useMyPRs(true, "favorites"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists.favorites).toEqual(favorites);
    expect(result.current.stale).toBe(true);
    expect(result.current.error).toMatch(/Gagal update/i);
  });

  it("surfaces rate-limit and generic errors without cache", async () => {
    mockFavorites
      .mockRejectedValueOnce(
        new Error(
          'github error 403: { "message": "You have exceeded a secondary rate limit." }',
        ),
      )
      .mockRejectedValueOnce(new Error("boom"));

    const { result, rerender } = renderHook(
      ({ tab }: { tab: "favorites" }) => useMyPRs(true, tab),
      { initialProps: { tab: "favorites" as const } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stale).toBe(false);
    expect(result.current.error).toMatch(/Belum ada cache/i);

    clearPrCacheForTests();
    rerender({ tab: "favorites" });
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Error: boom");
  });

  it("skips fetch when disabled", async () => {
    const { result } = renderHook(() => useMyPRs(false, "favorites"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFavorites).not.toHaveBeenCalled();
  });

  it("refresh force-reloads the active tab", async () => {
    mockFavorites.mockResolvedValue(favorites);
    const { result } = renderHook(() => useMyPRs(true, "favorites"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockFavorites).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });
    expect(mockFavorites).toHaveBeenCalledTimes(2);
  });

  it("refetches on refresh interval", async () => {
    vi.useFakeTimers();
    saveSettings({ ...getSettings(), refreshIntervalMin: 1 });
    mockFavorites.mockResolvedValue([]);

    renderHook(() => useMyPRs(true, "favorites"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockFavorites).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFavorites).toHaveBeenCalledTimes(2);
  });
});
