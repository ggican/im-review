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

import { ReposPage } from "./ReposPage";
import { RepoRow } from "./RepoRow";

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
    await user.click(
      screen.getByRole("button", { name: "Add to favorites" }),
    );
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
    await user.click(
      screen.getByRole("button", { name: "Add to favorites" }),
    );
    await user.click(screen.getByRole("button", { name: "Open on GitHub" }));
    expect(vi.mocked(openUrl)).toHaveBeenCalledWith(repos[1]!.htmlUrl);
  });
});
