import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr, makeRaw } from "@/test/fixtures";

vi.mock("@/lib/api", () => ({
  api: {
    validateToken: vi.fn(),
  },
}));

vi.mock("@/features/pr/api", () => ({
  fetchReviewRequestedPrs: vi.fn(),
  fetchMyOpenPrs: vi.fn(),
}));

vi.mock("./fetch", () => ({
  fetchEngineerMetrics: vi.fn(),
  buildDailyActivity: vi.fn(() => []),
}));

vi.mock("./score", () => ({
  buildCiHealthSummary: vi.fn(() => ({
    totalChecks: 0,
    passing: 0,
    pending: 0,
    failing: 0,
    passRate: 100,
    topFailingContexts: [],
    latestFailingPrs: [],
    prsWithChecks: 0,
  })),
  computeScorecard: vi.fn(() => ({
    overall: 80,
    speed: { category: "speed", label: "Speed", score: 80, weight: 1, metrics: [] },
    quality: {
      category: "quality",
      label: "Quality",
      score: 80,
      weight: 1,
      metrics: [],
    },
    throughput: {
      category: "throughput",
      label: "Throughput",
      score: 80,
      weight: 1,
      metrics: [],
    },
    collaboration: {
      category: "collaboration",
      label: "Collaboration",
      score: 80,
      weight: 1,
      metrics: [],
    },
    window: { from: "2026-01-01", to: "2026-01-07", days: 7, preset: "7", label: "7 days" },
    aggregation: "avg",
    generatedAt: "2026-01-07T00:00:00.000Z",
  })),
  computeTrends: vi.fn(() => null),
}));

vi.mock("./suggestions", () => ({
  buildMetricSuggestions: vi.fn(() => []),
}));

import { api } from "@/lib/api";
import {
  fetchMyOpenPrs,
  fetchReviewRequestedPrs,
} from "@/features/pr/api";

import { fetchEngineerMetrics } from "./fetch";
import { useMetrics } from "./hooks";
import { buildCiHealthSummary } from "./score";

const mockValidateToken = vi.mocked(api.validateToken);
const mockFetchMetrics = vi.mocked(fetchEngineerMetrics);
const mockReviewRequested = vi.mocked(fetchReviewRequestedPrs);
const mockMyOpenPrs = vi.mocked(fetchMyOpenPrs);
const mockCiHealth = vi.mocked(buildCiHealthSummary);

const current = makeRaw({ login: "alice" });
const previous = makeRaw({ login: "alice", window: current.window });

describe("useMetrics", () => {
  beforeEach(() => {
    mockValidateToken.mockReset();
    mockFetchMetrics.mockReset();
    mockReviewRequested.mockReset();
    mockMyOpenPrs.mockReset();
    mockCiHealth.mockReset();
    mockCiHealth.mockReturnValue({
      totalChecks: 0,
      passing: 0,
      pending: 0,
      failing: 0,
      passRate: 100,
      topFailingContexts: [],
      latestFailingPrs: [],
      prsWithChecks: 0,
    });
  });

  it("sets login and raw on success", async () => {
    mockValidateToken.mockResolvedValue({
      login: "alice",
      name: "Alice",
      avatar_url: "",
    });
    mockFetchMetrics.mockResolvedValue({ current, previous });
    mockReviewRequested.mockResolvedValue([makePr({ repo: "acme/r", number: 1 })]);
    mockMyOpenPrs.mockResolvedValue([makePr({ repo: "acme/m", number: 2 })]);

    const { result } = renderHook(() => useMetrics(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockValidateToken).toHaveBeenCalledTimes(1);
    expect(mockFetchMetrics).toHaveBeenCalledWith("alice", { preset: "7" });
    expect(result.current.login).toBe("alice");
    expect(result.current.raw).toEqual(current);
    expect(result.current.scorecard).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.updatedAt).toBeInstanceOf(Date);
    expect(mockCiHealth).toHaveBeenCalledWith(current.authored);
  });

  it("sets error when validateToken fails", async () => {
    mockValidateToken.mockRejectedValue(new Error("bad token"));

    const { result } = renderHook(() => useMetrics(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Error: bad token");
    expect(result.current.login).toBeNull();
    expect(result.current.raw).toBeNull();
    expect(mockFetchMetrics).not.toHaveBeenCalled();
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useMetrics(false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockFetchMetrics).not.toHaveBeenCalled();
    expect(result.current.raw).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
