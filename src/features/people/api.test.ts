import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: { githubGet: vi.fn() },
}));

import { api } from "@/lib/api";

import { fetchGithubUser, searchGithubUsers } from "./api";

const githubGet = vi.mocked(api.githubGet);

describe("people/api", () => {
  beforeEach(() => {
    githubGet.mockReset();
  });

  it("maps search users", async () => {
    githubGet.mockResolvedValue({
      items: [
        {
          login: "alice",
          name: "Alice",
          avatar_url: "a",
          html_url: "https://github.com/alice",
        },
      ],
    });
    const users = await searchGithubUsers("ali");
    expect(users[0]?.login).toBe("alice");
  });

  it("rejects invalid login before fetch", async () => {
    await expect(fetchGithubUser("nope login")).rejects.toThrow(/Invalid/);
    expect(githubGet).not.toHaveBeenCalled();
  });
});
