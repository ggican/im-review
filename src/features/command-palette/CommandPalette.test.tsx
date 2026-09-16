import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const cachedPr = makePr({ repo: "acme/app", number: 5, title: "Cached PR" });
const prCache = {
  all: [] as ReturnType<typeof makePr>[],
  favorites: [] as ReturnType<typeof makePr>[],
  assigned: [] as ReturnType<typeof makePr>[],
  review: [cachedPr],
  reviewed: [],
  mine: [] as ReturnType<typeof makePr>[],
};

vi.mock("@/features/pr/pr-cache", () => ({
  flattenPrCache: (lists: typeof prCache) => [
    ...lists.assigned,
    ...lists.review,
    ...lists.mine,
  ],
  getPrCache: () => prCache,
  subscribePrCache: () => () => {},
}));

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>();
  return {
    ...actual,
    getFavorites: () => ["acme/fav"],
    getFavoriteUsers: () => [
      {
        login: "devuser",
        name: "Dev User",
        avatarUrl: "",
        htmlUrl: "https://github.com/devuser",
        favoritedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
});

import { CommandPalette } from "./CommandPalette";

function renderPalette(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<CommandPalette />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("opens with meta+k and lists navigation items", async () => {
    const user = userEvent.setup();
    renderPalette();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Cached PR")).toBeInTheDocument();
    expect(screen.getByText("acme/fav")).toBeInTheDocument();
  });

  it("filters commands and navigates on Enter", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Meta>}k{/Meta}");

    const input = screen.getByRole("textbox", { name: "Search commands" });
    await user.type(input, "metrics");
    expect(screen.getByText("Metrics")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/metrics");
    });
  });

  it("navigates when clicking a PR row", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Control>}k{/Control}");
    await user.click(screen.getByRole("option", { name: /Cached PR/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/review/acme/app/5");
  });

  it("supports arrow keys and favorite/settings navigation", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Meta>}k{/Meta}");

    const input = screen.getByRole("textbox", { name: "Search commands" });
    await user.type(input, "repos");
    expect(screen.getByText("Repos")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/repos");
    });

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.clear(screen.getByRole("textbox", { name: "Search commands" }));
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "settings",
    );
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/settings");
    });

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.clear(screen.getByRole("textbox", { name: "Search commands" }));
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "acme/fav",
    );
    await user.click(screen.getByRole("option", { name: /acme\/fav/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/repos");
  });

  it("navigates to Gmail, Calendar, Jira, Metrics, and favorite people", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Meta>}k{/Meta}");

    const input = screen.getByRole("textbox", { name: "Search commands" });
    await user.type(input, "gmail");
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/gmail");

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "calendar",
    );
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/calendar");

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "jira",
    );
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/jira");

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "metrics",
    );
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/metrics");

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByRole("option", { name: /@devuser/ }));
    expect(mockNavigate).toHaveBeenCalledWith("/?author=devuser");
  });

  it("supports @author and user-prefix search shortcuts", async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "@octocat",
    );
    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith("/?author=octocat&by=all");

    mockNavigate.mockClear();
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(
      screen.getByRole("textbox", { name: "Search commands" }),
      "user alice",
    );
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });
});
