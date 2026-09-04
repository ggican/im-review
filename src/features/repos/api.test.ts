import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: { githubGet: vi.fn() },
}));

import { api } from "@/lib/api";

import { fetchAllRepos } from "./api";

const githubGet = vi.mocked(api.githubGet);

function repo(id: number) {
  return {
    id,
    full_name: `acme/r${id}`,
    description: null,
    private: false,
    html_url: `https://github.com/acme/r${id}`,
    updated_at: "2026-09-01T00:00:00Z",
    language: "TypeScript",
  };
}

describe("UNIT-API-016 fetchAllRepos", () => {
  beforeEach(() => githubGet.mockReset());

  it("pages until short batch", async () => {
    const full = Array.from({ length: 100 }, (_, i) => repo(i + 1));
    githubGet
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce([repo(101), repo(102)]);
    const all = await fetchAllRepos();
    expect(all).toHaveLength(102);
    expect(all[0]?.fullName).toBe("acme/r1");
    expect(githubGet).toHaveBeenCalledTimes(2);
  });

  it("stops on empty", async () => {
    githubGet.mockResolvedValueOnce([]);
    await expect(fetchAllRepos()).resolves.toEqual([]);
  });
});
