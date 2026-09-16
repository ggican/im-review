import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getFavoriteUsers,
  removeFavoriteUser,
  toggleFavoriteUser,
} from "@/lib/settings";
import { makePr } from "@/test/fixtures";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./api", () => ({
  fetchGithubUser: vi.fn(),
  searchGithubUsers: vi.fn(),
}));

vi.mock("@/features/pr/api", () => ({
  fetchOpenPrsByAuthor: vi.fn(),
}));

import { toast } from "sonner";

import { fetchOpenPrsByAuthor } from "@/features/pr/api";

import { fetchGithubUser, searchGithubUsers } from "./api";
import { PeoplePage } from "./PeoplePage";

const mockFetchGithubUser = vi.mocked(fetchGithubUser);
const mockSearchGithubUsers = vi.mocked(searchGithubUsers);
const mockFetchOpenPrsByAuthor = vi.mocked(fetchOpenPrsByAuthor);
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

function renderPeople() {
  return render(
    <MemoryRouter>
      <PeoplePage />
    </MemoryRouter>,
  );
}

describe("PeoplePage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockFetchGithubUser.mockReset();
    mockSearchGithubUsers.mockReset();
    mockFetchOpenPrsByAuthor.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    for (const u of [...getFavoriteUsers()]) {
      removeFavoriteUser(u.login);
    }
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders favorites empty state", () => {
    renderPeople();
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByText(/No favorite people yet/)).toBeInTheDocument();
  });

  it("lists favorites and loads open PRs when a person is selected", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "https://avatars/alice",
      htmlUrl: "https://github.com/alice",
    });
    toggleFavoriteUser({
      login: "bob",
      name: "Bob",
      avatarUrl: "",
      htmlUrl: "https://github.com/bob",
    });

    const pr = makePr({
      repo: "acme/app",
      number: 7,
      title: "Alice PR",
      author: { login: "alice", avatarUrl: "" },
    });
    mockFetchOpenPrsByAuthor.mockResolvedValue([pr]);

    renderPeople();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Alice/ }));

    await waitFor(() => {
      expect(mockFetchOpenPrsByAuthor).toHaveBeenCalledWith("alice");
    });
    expect(await screen.findByText("Alice PR")).toBeInTheDocument();
    expect(screen.getByText(/acme\/app#7/)).toBeInTheDocument();
  });

  it("navigates to review when an open PR is clicked", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "",
      htmlUrl: "https://github.com/alice",
    });
    mockFetchOpenPrsByAuthor.mockResolvedValue([
      makePr({ repo: "acme/app", number: 9, title: "Review me" }),
    ]);

    renderPeople();
    await user.click(screen.getByRole("button", { name: /Alice/ }));
    await screen.findByText("Review me");

    await user.click(screen.getByRole("button", { name: /Review me/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/9");
  });

  it("toggles favorite star on a person row", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "",
      htmlUrl: "https://github.com/alice",
    });

    renderPeople();
    expect(getFavoriteUsers()).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Remove favorite person" }),
    );
    expect(getFavoriteUsers()).toHaveLength(0);
    expect(screen.getByText(/No favorite people yet/)).toBeInTheDocument();
  });

  it("adds a person by login on the favorites tab", async () => {
    const user = userEvent.setup();
    mockFetchGithubUser.mockResolvedValue({
      login: "carol",
      name: "Carol",
      avatarUrl: "https://avatars/carol",
      htmlUrl: "https://github.com/carol",
    });

    renderPeople();

    await user.type(screen.getByLabelText("Add by login"), "carol");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockFetchGithubUser).toHaveBeenCalledWith("carol");
    });
    expect(getFavoriteUsers().some((u) => u.login === "carol")).toBe(true);
    expect(mockToastSuccess).toHaveBeenCalledWith("Favorited @carol");
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });

  it("shows toast when add by login fails", async () => {
    const user = userEvent.setup();
    mockFetchGithubUser.mockRejectedValue(new Error("404"));

    renderPeople();
    await user.type(screen.getByLabelText("Add by login"), "missing");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "GitHub user @missing not found",
      );
    });
  });

  it("searches GitHub users on the search tab", async () => {
    const user = userEvent.setup();
    mockSearchGithubUsers.mockResolvedValue([
      {
        login: "dave",
        name: "Dave",
        avatarUrl: "",
        htmlUrl: "https://github.com/dave",
      },
    ]);

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    expect(screen.getByLabelText("Search GitHub users")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search GitHub users"), "d");
    expect(screen.getByText("Type at least 2 characters.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search GitHub users"), "ave");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(mockSearchGithubUsers).toHaveBeenCalledWith("dave");
    });
    expect(await screen.findByText("Dave")).toBeInTheDocument();
    expect(screen.getByText("@dave")).toBeInTheDocument();
  });

  it("shows PR error when fetchOpenPrsByAuthor fails", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "",
      htmlUrl: "https://github.com/alice",
    });
    mockFetchOpenPrsByAuthor.mockRejectedValue(new Error("rate limited"));

    renderPeople();
    await user.click(screen.getByRole("button", { name: /Alice/ }));

    expect(await screen.findByText("Error: rate limited")).toBeInTheDocument();
  });

  it("shows empty PR list and select prompt", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "",
      htmlUrl: "https://github.com/alice",
    });
    mockFetchOpenPrsByAuthor.mockResolvedValue([]);

    renderPeople();
    expect(
      screen.getByText("Select a person to list their open PRs."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Alice/ }));
    expect(
      await screen.findByText("No open PRs by @alice."),
    ).toBeInTheDocument();
  });

  it("shows PR loading state", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "alice",
      name: "Alice",
      avatarUrl: "",
      htmlUrl: "https://github.com/alice",
    });
    mockFetchOpenPrsByAuthor.mockImplementation(() => new Promise(() => {}));

    renderPeople();
    await user.click(screen.getByRole("button", { name: /Alice/ }));
    expect(
      await screen.findByText("Loading PRs by @alice…"),
    ).toBeInTheDocument();
  });

  it("favorites a person from search results", async () => {
    const user = userEvent.setup();
    mockSearchGithubUsers.mockResolvedValue([
      {
        login: "eve",
        name: "Eve Example",
        avatarUrl: "",
        htmlUrl: "https://github.com/eve",
      },
    ]);

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    await user.type(screen.getByLabelText("Search GitHub users"), "eve");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText("Eve Example")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Favorite person" }));
    expect(getFavoriteUsers().some((u) => u.login === "eve")).toBe(true);
  });

  it("shows search loading and no-match states", async () => {
    const user = userEvent.setup();
    mockSearchGithubUsers.mockImplementation(() => new Promise(() => {}));

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    await user.type(screen.getByLabelText("Search GitHub users"), "zz");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText("Searching…")).toBeInTheDocument();

    mockSearchGithubUsers.mockResolvedValue([]);
    await user.type(screen.getByLabelText("Search GitHub users"), "zzz");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText("No users match.")).toBeInTheDocument();
  });

  it("surfaces search failure toast", async () => {
    const user = userEvent.setup();
    mockSearchGithubUsers.mockRejectedValue(new Error("search down"));

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    await user.type(screen.getByLabelText("Search GitHub users"), "fail");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error: search down");
    });
  });

  it("validates empty login on favorites tab", async () => {
    const user = userEvent.setup();
    renderPeople();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(mockToastError).toHaveBeenCalledWith("Enter a valid GitHub login");
  });

  it("switches back to favorites tab and selects search result", async () => {
    const user = userEvent.setup();
    mockSearchGithubUsers.mockResolvedValue([
      {
        login: "frank",
        name: "Frank",
        avatarUrl: "",
        htmlUrl: "https://github.com/frank",
      },
    ]);
    mockFetchOpenPrsByAuthor.mockResolvedValue([]);

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    await user.type(screen.getByLabelText("Search GitHub users"), "frank");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await screen.findByText("Frank");

    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(screen.getByText(/No favorite people yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Search" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await user.click(await screen.findByRole("button", { name: /Frank/ }));
    expect(
      await screen.findByText("No open PRs by @frank."),
    ).toBeInTheDocument();
  });

  it("blocks add when favorite people limit is reached", async () => {
    const user = userEvent.setup();
    const { MAX_FAVORITE_USERS } = await import("@/lib/settings");
    for (let i = 0; i < MAX_FAVORITE_USERS; i += 1) {
      toggleFavoriteUser({
        login: `user${i}`,
        name: null,
        avatarUrl: "",
        htmlUrl: `https://github.com/user${i}`,
      });
    }
    mockFetchGithubUser.mockResolvedValue({
      login: "newbie",
      name: "Newbie",
      avatarUrl: "",
      htmlUrl: "https://github.com/newbie",
    });

    renderPeople();
    await user.type(screen.getByLabelText("Add by login"), "newbie");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        `Favorite people limit is ${MAX_FAVORITE_USERS}`,
      );
    });
  });

  it("blocks favorite from search when at people limit", async () => {
    const user = userEvent.setup();
    const { MAX_FAVORITE_USERS } = await import("@/lib/settings");
    for (let i = 0; i < MAX_FAVORITE_USERS; i += 1) {
      toggleFavoriteUser({
        login: `user${i}`,
        name: null,
        avatarUrl: "",
        htmlUrl: `https://github.com/user${i}`,
      });
    }
    mockSearchGithubUsers.mockResolvedValue([
      {
        login: "searchonly",
        name: "Search Only",
        avatarUrl: "",
        htmlUrl: "https://github.com/searchonly",
      },
    ]);

    renderPeople();
    await user.click(screen.getByRole("tab", { name: "Search" }));
    await user.type(screen.getByLabelText("Search GitHub users"), "search");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(await screen.findByText("Search Only")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Favorite person" }));
    expect(mockToastError).toHaveBeenCalledWith(
      `Favorite people limit is ${MAX_FAVORITE_USERS}`,
    );
    expect(getFavoriteUsers().some((u) => u.login === "searchonly")).toBe(
      false,
    );
  });
});
