import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSettings, saveSettings } from "@/lib/settings";
import { makePr } from "@/test/fixtures";

vi.mock("./api", () => ({
  fetchAssignedPrs: vi.fn(),
  fetchReviewRequestedPrs: vi.fn(),
  fetchMyOpenPrs: vi.fn(),
}));

vi.mock("./pr-cache", () => ({
  setPrCache: vi.fn(),
}));

import {
  fetchAssignedPrs,
  fetchMyOpenPrs,
  fetchReviewRequestedPrs,
} from "./api";
import { useMyPRs } from "./hooks";
import { setPrCache } from "./pr-cache";

const mockAssigned = vi.mocked(fetchAssignedPrs);
const mockReview = vi.mocked(fetchReviewRequestedPrs);
const mockMine = vi.mocked(fetchMyOpenPrs);
const mockSetPrCache = vi.mocked(setPrCache);

const assigned = [makePr({ repo: "acme/a", number: 1 })];
const review = [makePr({ repo: "acme/r", number: 2 })];
const mine = [makePr({ repo: "acme/m", number: 3 })];

describe("useMyPRs", () => {
  beforeEach(() => {
    saveSettings({ ...getSettings(), refreshIntervalMin: 0 });
    mockAssigned.mockReset();
    mockReview.mockReset();
    mockMine.mockReset();
    mockSetPrCache.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads lists when enabled", async () => {
    mockAssigned.mockResolvedValue(assigned);
    mockReview.mockResolvedValue(review);
    mockMine.mockResolvedValue(mine);

    const { result } = renderHook(() => useMyPRs(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lists.assigned).toEqual(assigned);
    expect(result.current.lists.review).toEqual(review);
    expect(result.current.lists.mine).toEqual(mine);
    expect(result.current.error).toBeNull();
    expect(result.current.updatedAt).toBeInstanceOf(Date);
    expect(mockSetPrCache).toHaveBeenCalledWith({
      assigned,
      review,
      mine,
    });
    expect(mockAssigned).toHaveBeenCalledTimes(1);
    expect(mockReview).toHaveBeenCalledTimes(1);
    expect(mockMine).toHaveBeenCalledTimes(1);
  });

  it("sets error when fetch fails", async () => {
    mockAssigned.mockRejectedValue(new Error("network down"));
    mockReview.mockResolvedValue([]);
    mockMine.mockResolvedValue([]);

    const { result } = renderHook(() => useMyPRs(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Error: network down");
    expect(result.current.lists).toEqual({
      assigned: [],
      review: [],
      mine: [],
    });
    expect(mockSetPrCache).not.toHaveBeenCalled();
  });

  it("skips fetch when disabled", async () => {
    const { result } = renderHook(() => useMyPRs(false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockAssigned).not.toHaveBeenCalled();
    expect(mockReview).not.toHaveBeenCalled();
    expect(mockMine).not.toHaveBeenCalled();
    expect(result.current.lists).toEqual({
      assigned: [],
      review: [],
      mine: [],
    });
    expect(result.current.error).toBeNull();
  });

  it("count returns tab lengths", async () => {
    mockAssigned.mockResolvedValue(assigned);
    mockReview.mockResolvedValue(review);
    mockMine.mockResolvedValue(mine);

    const { result } = renderHook(() => useMyPRs(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.count("assigned")).toBe(1);
    expect(result.current.count("review")).toBe(1);
    expect(result.current.count("mine")).toBe(1);
  });

  it("refetches on refresh interval", async () => {
    vi.useFakeTimers();
    saveSettings({ ...getSettings(), refreshIntervalMin: 1 });
    mockAssigned.mockResolvedValue([]);
    mockReview.mockResolvedValue([]);
    mockMine.mockResolvedValue([]);

    renderHook(() => useMyPRs(true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockAssigned).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockAssigned).toHaveBeenCalledTimes(2);
  });
});
