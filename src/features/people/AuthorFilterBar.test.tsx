import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FavoriteUser } from "@/features/people/types";
import { makePr } from "@/test/fixtures";

import { AuthorFilterBar } from "./AuthorFilterBar";

const alice: FavoriteUser = {
  login: "alice",
  name: "Alice Smith",
  avatarUrl: "https://avatars/alice",
  htmlUrl: "https://github.com/alice",
  favoritedAt: "2026-01-01T00:00:00.000Z",
};

const bob: FavoriteUser = {
  login: "bob",
  name: "Bob Jones",
  avatarUrl: "https://avatars/bob",
  htmlUrl: "https://github.com/bob",
  favoritedAt: "2026-01-02T00:00:00.000Z",
};

const tabItems = [
  makePr({
    repo: "acme/app",
    number: 1,
    author: { login: "alice", avatarUrl: "https://avatars/alice" },
  }),
  makePr({
    repo: "acme/app",
    number: 2,
    author: { login: "carol", avatarUrl: "" },
  }),
];

describe("AuthorFilterBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows favorite chips and selects author in filter mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice, bob]}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Filter by @alice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filter by @bob" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filter by @alice" }));
    expect(onChange).toHaveBeenCalledWith("alice", "filter");
  });

  it("clears active author chip", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthorFilterBar
        authorLogin="alice"
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "@alice ×" }));
    expect(onChange).toHaveBeenCalledWith(null, "filter");
  });

  it("shows search mode label on active chip", () => {
    render(
      <AuthorFilterBar
        authorLogin="carol"
        authorMode="search"
        tabItems={tabItems}
        favoriteUsers={[alice]}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "@carol · all ×" }),
    ).toBeInTheDocument();
  });

  it("opens suggestions and applies filter from dropdown", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice, bob]}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Filter by author");
    await user.click(input);
    expect(screen.getByRole("button", { name: "@alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "@bob" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "@bob" }));
    expect(onChange).toHaveBeenCalledWith("bob", "search");
  });

  it("filters suggestions by query and matches favorite display names", async () => {
    const user = userEvent.setup();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice, bob]}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Filter by author");
    await user.type(input, "smith");
    expect(screen.getByRole("button", { name: "@alice" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "@bob" }),
    ).not.toBeInTheDocument();
  });

  it("submits form with filter mode when author is in tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice]}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Filter by author");
    await user.type(input, "@alice");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("alice", "filter");
  });

  it("submits form with search mode when author is not in tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice]}
        onChange={onChange}
      />,
    );

    const input = screen.getByLabelText("Filter by author");
    await user.type(input, "dave");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("dave", "search");
  });

  it("closes suggestions after blur timeout", async () => {
    const user = userEvent.setup();

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={tabItems}
        favoriteUsers={[alice, bob]}
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Filter by author");
    await user.click(input);
    expect(screen.getByRole("button", { name: "@alice" })).toBeInTheDocument();

    input.blur();
    await act(async () => {
      vi.advanceTimersByTime(120);
    });

    expect(
      screen.queryByRole("button", { name: "@alice" }),
    ).not.toBeInTheDocument();
  });

  it("shows extra favorites count when more than eight chips", () => {
    const manyFavorites = Array.from({ length: 10 }, (_, i) => ({
      login: `user${i}`,
      name: `User ${i}`,
      avatarUrl: "",
      htmlUrl: `https://github.com/user${i}`,
      favoritedAt: "2026-01-01T00:00:00.000Z",
    }));

    render(
      <AuthorFilterBar
        authorLogin={null}
        authorMode="filter"
        tabItems={[]}
        favoriteUsers={manyFavorites}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
