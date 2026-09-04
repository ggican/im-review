import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repo } from "./types";

vi.mock("./api", () => ({
  fetchAllRepos: vi.fn(),
}));

import { fetchAllRepos } from "./api";
import { useRepos } from "./hooks";

const mockFetchAllRepos = vi.mocked(fetchAllRepos);

const repos: Repo[] = [
  {
    id: 1,
    fullName: "acme/web-app",
    description: "Main web client",
    private: false,
    htmlUrl: "https://github.com/acme/web-app",
    updatedAt: "2026-09-01T00:00:00Z",
    language: "TypeScript",
  },
  {
    id: 2,
    fullName: "acme/docs",
    description: "Documentation site",
    private: true,
    htmlUrl: "https://github.com/acme/docs",
    updatedAt: "2026-09-02T00:00:00Z",
    language: "Markdown",
  },
];

describe("useRepos", () => {
  beforeEach(() => {
    mockFetchAllRepos.mockReset();
  });

  it("loads repos when enabled", async () => {
    mockFetchAllRepos.mockResolvedValue(repos);

    const { result } = renderHook(() => useRepos(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.repos).toEqual(repos);
    expect(result.current.filtered).toEqual(repos);
    expect(result.current.error).toBeNull();
    expect(mockFetchAllRepos).toHaveBeenCalledTimes(1);
  });

  it("filters repos by query", async () => {
    mockFetchAllRepos.mockResolvedValue(repos);

    const { result } = renderHook(() => useRepos(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery("typescript");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0]?.fullName).toBe("acme/web-app");

    act(() => {
      result.current.setQuery("documentation");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0]?.fullName).toBe("acme/docs");

    act(() => {
      result.current.setQuery("");
    });

    expect(result.current.filtered).toEqual(repos);
  });

  it("sets error when fetch fails", async () => {
    mockFetchAllRepos.mockRejectedValue(new Error("rate limited"));

    const { result } = renderHook(() => useRepos(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Error: rate limited");
    expect(result.current.repos).toEqual([]);
  });

  it("skips fetch when disabled", async () => {
    const { result } = renderHook(() => useRepos(false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchAllRepos).not.toHaveBeenCalled();
    expect(result.current.repos).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
