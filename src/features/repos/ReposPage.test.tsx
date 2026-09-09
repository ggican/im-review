import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repo } from "./types";

const mockUseRepos = vi.fn();
const mockUseFavorites = vi.fn();

vi.mock("./hooks", () => ({
  useRepos: (...args: unknown[]) => mockUseRepos(...args),
}));

vi.mock("@/lib/use-settings", () => ({
  useFavorites: () => mockUseFavorites(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/features/pr/api", () => ({
  fetchOpenPullsForRepo: vi.fn().mockResolvedValue([
    {
      id: 1,
      number: 7,
      repo: "acme/alpha",
      title: "Add feature",
      url: "https://github.com/acme/alpha/pull/7",
      state: "open",
      author: { login: "alice", avatarUrl: "" },
      isDraft: false,
      updatedAt: "2026-09-04T12:00:00.000Z",
      createdAt: "2026-09-01T12:00:00.000Z",
      headBranch: "feat/alpha-1",
    },
  ]),
}));

import { RepoRow } from "./RepoRow";
import { ReposPage } from "./ReposPage";

function renderReposPage() {
  return render(
    <MemoryRouter>
      <ReposPage />
    </MemoryRouter>,
  );
}

const repos: Repo[] = [
  {
    id: 1,
    fullName: "acme/alpha",
    description: "Alpha repo",
    private: false,
    htmlUrl: "https://github.com/acme/alpha",
    updatedAt: "2026-09-04T12:00:00.000Z",
    language: "TypeScript",
  },
  {
    id: 2,
    fullName: "acme/beta",
    description: "Beta repo",
    private: true,
    htmlUrl: "https://github.com/acme/beta",
    updatedAt: "2026-09-03T12:00:00.000Z",
    language: "Go",
  },
];

describe("ReposPage", () => {
  beforeEach(() => {
    mockUseFavorites.mockReturnValue(["acme/alpha"]);
    mockUseRepos.mockReturnValue({
      filtered: repos,
      loading: false,
      error: null,
      query: "",
      setQuery: vi.fn(),
      refresh: vi.fn(),
      repos,
    });
  });

  it("opens repo detail with active branches / open PRs", async () => {
    const user = userEvent.setup();
    renderReposPage();
    await user.click(screen.getByText("acme/alpha"));
    expect(
      await screen.findByText(/Open PRs \/ active head branches/),
    ).toBeInTheDocument();
    expect(await screen.findByText("feat/alpha-1")).toBeInTheDocument();
    expect(screen.getByText("Add feature")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Back to repos/ }));
    expect(screen.getByRole("heading", { name: "Repos" })).toBeInTheDocument();
  });

  it("renders favorites tab with favorite repo row", () => {
    renderReposPage();
    expect(screen.getByRole("heading", { name: "Repos" })).toBeInTheDocument();
    expect(screen.getByText("Favorite repos")).toBeInTheDocument();
    expect(screen.getByText("acme/alpha")).toBeInTheDocument();
    expect(screen.getByText(/1 favorite/)).toBeInTheDocument();
  });

  it("switches to all repos tab and filters via search input", async () => {
    const user = userEvent.setup();
    const setQuery = vi.fn();
    mockUseRepos.mockReturnValue({
      filtered: repos,
      loading: false,
      error: null,
      query: "",
      setQuery,
      refresh: vi.fn(),
      repos,
    });

    renderReposPage();
    await user.click(screen.getByRole("tab", { name: /All repos/ }));
    expect(screen.getByText("All repos")).toBeInTheDocument();
    expect(screen.getByText("acme/beta")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search repos…"), "beta");
    expect(setQuery).toHaveBeenCalled();
  });

  it("shows error banner when hook returns error", () => {
    mockUseRepos.mockReturnValue({
      filtered: [],
      loading: false,
      error: "Failed to load repos",
      query: "",
      setQuery: vi.fn(),
      refresh: vi.fn(),
      repos: [],
    });
    renderReposPage();
    expect(screen.getByText("Failed to load repos")).toBeInTheDocument();
  });

  it("toggles favorite on all repos tab and refreshes list", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    mockUseRepos.mockReturnValue({
      filtered: repos,
      loading: false,
      error: null,
      query: "",
      setQuery: vi.fn(),
      refresh,
      repos,
    });
    renderReposPage();
    await user.click(screen.getByRole("tab", { name: /All repos/ }));
    await user.click(screen.getByRole("button", { name: "Add to favorites" }));
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows loading and empty search states on all repos tab", async () => {
    const user = userEvent.setup();
    mockUseRepos.mockReturnValue({
      filtered: [],
      loading: true,
      error: null,
      query: "missing",
      setQuery: vi.fn(),
      refresh: vi.fn(),
      repos: [],
    });
    renderReposPage();
    await user.click(screen.getByRole("tab", { name: /All repos/ }));
    expect(screen.getByText("Loading repositories…")).toBeInTheDocument();
  });

  it("toggles repo favorite star and opens repo link", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(<RepoRow repo={repos[1]!} favorited={false} />);
    await user.click(screen.getByRole("button", { name: "Add to favorites" }));
    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(vi.mocked(openUrl)).toHaveBeenCalledWith(repos[1]!.htmlUrl);
  });

  it("surfaces openUrl failures on RepoRow", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    const { toast } = await import("sonner");
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("blocked"));
    render(<RepoRow repo={repos[0]!} favorited onOpenDetail={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: blocked");
  });
});
