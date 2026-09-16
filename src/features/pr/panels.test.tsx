import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

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

import { toast } from "sonner";

vi.mock("@/features/pr/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/pr/api")>();
  return {
    ...actual,
    fetchHeadBranch: vi.fn(),
    fetchPrDetail: vi.fn(),
    submitReview: vi.fn(),
    dismissReview: vi.fn(),
    updateReviewComment: vi.fn(),
    deleteReviewComment: vi.fn(),
    replyToReviewComment: vi.fn(),
    postIssueComment: vi.fn(),
    updateIssueComment: vi.fn(),
    deleteIssueComment: vi.fn(),
  };
});

vi.mock("@/lib/use-settings", () => ({
  useFavoriteBranches: vi.fn(() => []),
  useFavoriteUsers: vi.fn(() => []),
  useSettings: vi.fn(() => ({
    refreshIntervalMin: 5,
    theme: "system",
    favoritesOnly: true,
    showFavoriteOpen: true,
    showFavoritePeople: false,
    aiProvider: "cursor",
  })),
  useTemplates: vi.fn(() => [
    { id: "lgtm", name: "LGTM", body: "Looks good!" },
  ]),
}));

import { openUrl } from "@tauri-apps/plugin-opener";

import {
  deleteIssueComment,
  deleteReviewComment,
  dismissReview,
  fetchHeadBranch,
  fetchPrDetail,
  postIssueComment,
  replyToReviewComment,
  submitReview,
  updateIssueComment,
  updateReviewComment,
} from "@/features/pr/api";
import {
  getFavoriteBranches,
  getFavoriteUsers,
  MAX_FAVORITE_USERS,
  removeFavoriteBranch,
  removeFavoriteUser,
  toggleFavoriteBranch,
  toggleFavoriteUser,
} from "@/lib/settings";
import {
  useFavoriteBranches,
  useFavoriteUsers,
  useSettings,
} from "@/lib/use-settings";

import { ChangedFilesPanel } from "./ChangedFilesPanel";
import { CiChecksPanel } from "./CiChecksPanel";
import { ConversationPanel } from "./ConversationPanel";
import { CurrentReviewsPanel } from "./CurrentReviewsPanel";
import { PRDetailDrawer } from "./PRDetailDrawer";
import { PR_LIST_PAGE_SIZE, PRList } from "./PRList";
import { PRRow } from "./PRRow";
import type { CiChecksSnapshot, PrReviewsSnapshot } from "./types";

const mockUseFavoriteBranches = vi.mocked(useFavoriteBranches);
const mockUseFavoriteUsers = vi.mocked(useFavoriteUsers);
const mockUseSettings = vi.mocked(useSettings);

const mockFetchHeadBranch = vi.mocked(fetchHeadBranch);
const mockFetchPrDetail = vi.mocked(fetchPrDetail);
const mockSubmitReview = vi.mocked(submitReview);
const mockDismissReview = vi.mocked(dismissReview);
const mockUpdateReviewComment = vi.mocked(updateReviewComment);
const mockDeleteReviewComment = vi.mocked(deleteReviewComment);
const mockReplyToReviewComment = vi.mocked(replyToReviewComment);
const mockPostIssueComment = vi.mocked(postIssueComment);
const mockUpdateIssueComment = vi.mocked(updateIssueComment);
const mockDeleteIssueComment = vi.mocked(deleteIssueComment);
const mockOpenUrl = vi.mocked(openUrl);

const pr = makePr({
  repo: "acme/app",
  number: 12,
  title: "Add feature",
  headBranch: "feat/x",
  localReviewEvent: "APPROVE",
});

const pendingPr = makePr({
  repo: "acme/app",
  number: 13,
  title: "Needs review",
});

const ciSnapshot: CiChecksSnapshot = {
  overall: "failure",
  sha: "abc1234",
  failedCount: 1,
  pendingCount: 1,
  successCount: 1,
  items: [
    {
      id: "1",
      name: "build",
      state: "failure",
      description: "Failed compile",
      targetUrl: "https://ci.example/build/1",
      source: "check_run",
      updatedAt: "2026-09-04T12:00:00.000Z",
    },
    {
      id: "2",
      name: "lint",
      state: "success",
      description: "Passed",
      targetUrl: null,
      source: "status",
      updatedAt: null,
    },
  ],
};

const reviewsSnapshot: PrReviewsSnapshot = {
  reviews: [
    {
      id: 1,
      user: "bob",
      avatarUrl: "",
      state: "APPROVED",
      body: "Nice work",
      submittedAt: "2026-09-04T11:00:00.000Z",
      htmlUrl: "https://github.com/review/1",
      comments: [
        {
          id: 9,
          path: "src/a.ts",
          line: 10,
          body: "nit",
          user: "bob",
          avatarUrl: "",
          createdAt: "2026-09-04T11:00:00.000Z",
          htmlUrl: "https://github.com/comment/9",
          reviewId: 1,
          inReplyToId: null,
          isOwn: false,
        },
      ],
    },
  ],
  latestByUser: [{ user: "bob", avatarUrl: "", state: "APPROVED" }],
  inlineCount: 1,
};

describe("PRRow", () => {
  beforeEach(() => {
    mockFetchHeadBranch.mockResolvedValue("feat/x");
    mockUseFavoriteBranches.mockReturnValue([]);
    mockUseFavoriteUsers.mockReturnValue([]);
    for (const u of [...getFavoriteUsers()]) {
      removeFavoriteUser(u.login);
    }
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  });

  it("renders PR metadata and handles select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PRRow pr={pendingPr} onSelect={onSelect} isNew />);
    expect(screen.getByTestId("needs-review-badge")).toHaveTextContent(
      "Needs review",
    );
    expect(screen.getByText("New")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review Diff" }));
    expect(onSelect).toHaveBeenCalledWith(pendingPr);
  });

  it("shows reviewed state and favorite branch badge", () => {
    render(<PRRow pr={pr} onSelect={vi.fn()} />);
    expect(screen.getByText(/Already reviewed/)).toBeInTheDocument();
  });

  it("toggles favorite branch and copies link", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(<PRRow pr={pendingPr} onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Favorite branch" }));
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Favorited branch feat/x",
      );
    });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Link copied");
    await user.click(screen.getByRole("button", { name: "Open in browser" }));
    expect(openUrl).toHaveBeenCalledWith(pendingPr.url);
  });

  it("shows head → base branch direction", () => {
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 20,
          title: "With base",
          headBranch: "feat/y",
          baseBranch: "develop",
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/feat\/y → develop/)).toBeInTheDocument();
  });

  it("shows base-only branch when head unknown", () => {
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 21,
          title: "Base only",
          baseBranch: "main",
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/→ main/)).toBeInTheDocument();
  });

  it("shows request-changes and draft badges", () => {
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 14,
          title: "Changes",
          localReviewEvent: "REQUEST_CHANGES",
          isDraft: true,
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Already reviewed/)).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows commented review label and handles copy/favorite failures", async () => {
    const user = userEvent.setup();
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 15,
          title: "Comment only",
          localReviewEvent: "COMMENT",
          headBranch: "feat/c",
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Already reviewed/)).toBeInTheDocument();

    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("denied"),
    );
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Could not copy link");

    mockFetchHeadBranch.mockRejectedValueOnce(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Favorite branch" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: network");
    });
  });

  it("handles open in browser failure", async () => {
    const user = userEvent.setup();
    mockOpenUrl.mockRejectedValueOnce(new Error("blocked"));
    render(<PRRow pr={pendingPr} onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Open in browser" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: blocked");
  });

  it("shows starred branch badge and removes favorite", async () => {
    const user = userEvent.setup();
    for (const b of [...getFavoriteBranches()]) {
      removeFavoriteBranch(b.id);
    }
    toggleFavoriteBranch({
      repo: pendingPr.repo,
      branch: "feat/x",
      prNumber: pendingPr.number,
      title: pendingPr.title,
      url: pendingPr.url,
    });
    mockUseFavoriteBranches.mockReturnValue([
      {
        id: "fb-1",
        repo: pendingPr.repo,
        branch: "feat/x",
        prNumber: pendingPr.number,
        title: pendingPr.title,
        url: pendingPr.url,
        favoritedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(<PRRow pr={pendingPr} onSelect={vi.fn()} />);
    expect(screen.getByText("Branch favorite")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove favorite branch" }),
    );
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Removed favorite feat/x",
      );
    });
  });

  it("shows CI failure badges and draft CTA", () => {
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 16,
          title: "Broken build",
          isDraft: true,
        })}
        onSelect={vi.fn()}
        ciFailure="build failed on main"
      />,
    );
    expect(screen.getAllByText("CI failed").length).toBeGreaterThan(0);
    expect(screen.getByText("build failed on main")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View Draft Diff" }),
    ).toBeInTheDocument();
  });

  it("filters by author and toggles person favorite", async () => {
    const user = userEvent.setup();
    const onFilterAuthor = vi.fn();
    const authorPr = makePr({
      repo: "acme/app",
      number: 17,
      title: "Author row",
      author: { login: "devuser", avatarUrl: "" },
    });
    render(
      <PRRow
        pr={authorPr}
        onSelect={vi.fn()}
        onFilterAuthor={onFilterAuthor}
      />,
    );
    await user.click(screen.getByRole("button", { name: "devuser" }));
    expect(onFilterAuthor).toHaveBeenCalledWith("devuser");

    await user.click(screen.getByRole("button", { name: "Favorite person" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Favorited @devuser");

    mockUseFavoriteUsers.mockReturnValue([
      {
        login: "devuser",
        name: null,
        avatarUrl: "",
        htmlUrl: "https://github.com/devuser",
        favoritedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(
      <PRRow
        pr={authorPr}
        onSelect={vi.fn()}
        onFilterAuthor={onFilterAuthor}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Remove favorite person" }),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Removed @devuser from people",
    );
  });

  it("blocks person favorite when at limit", async () => {
    const user = userEvent.setup();
    for (let i = 0; i < MAX_FAVORITE_USERS; i += 1) {
      toggleFavoriteUser({
        login: `user${i}`,
        name: null,
        avatarUrl: "",
        htmlUrl: `https://github.com/user${i}`,
      });
    }
    render(
      <PRRow
        pr={makePr({
          repo: "acme/app",
          number: 18,
          title: "Limit test",
          author: {
            login: "newbie",
            avatarUrl: "https://avatar.example/x.png",
          },
        })}
        onSelect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Favorite person" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      `Favorite people limit is ${MAX_FAVORITE_USERS}`,
    );
  });

  it("selects PR from title button", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PRRow pr={pendingPr} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: pendingPr.title }));
    expect(onSelect).toHaveBeenCalledWith(pendingPr);
  });

  it("opens PR via icon button and matches favorite by pr number without head", () => {
    mockUseFavoriteBranches.mockReturnValue([
      {
        id: "fb-2",
        repo: "acme/app",
        branch: "unknown",
        prNumber: 19,
        title: "No head",
        url: "https://github.com/acme/app/pull/19",
        favoritedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const onSelect = vi.fn();
    const noHead = makePr({
      repo: "acme/app",
      number: 19,
      title: "No head branch",
    });
    render(<PRRow pr={noHead} onSelect={onSelect} />);
    expect(screen.getByText("Branch favorite")).toBeInTheDocument();
    screen.getByRole("button", { name: "Open pull request" }).click();
    expect(onSelect).toHaveBeenCalledWith(noHead);
  });
});

describe("PRList", () => {
  it("renders tabs, empty state, and PR rows", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            assigned: [],
            review: [pendingPr],
            reviewed: [],
            mine: [pr],
            favorites: [],
            people: [],
          }}
          active="review"
          onTabChange={onTabChange}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-04T12:00:00.000Z")}
          onSelect={onSelect}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /Review requested/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /My open/ }));
    expect(onTabChange).toHaveBeenCalledWith("mine");
    await user.click(screen.getByRole("button", { name: "Review Diff" }));
    expect(onSelect).toHaveBeenCalledWith(pendingPr);
  });

  it("shows Already reviewed tab empty state", () => {
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="reviewed"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/No reviews submitted from IM Review yet/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open History" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("lists items on Already reviewed tab without Needs review header", () => {
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [],
            reviewed: [pr],
            mine: [],
            people: [],
          }}
          active="reviewed"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date()}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Add feature")).toBeInTheDocument();
    expect(screen.queryByText(/Needs review/)).not.toBeInTheDocument();
  });

  it("shows error and favorites empty message", () => {
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            favorites: [],
            people: [],
          }}
          active="favorites"
          onTabChange={vi.fn()}
          loading={false}
          error="boom"
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage favorites" }),
    ).toHaveAttribute("href", "/repos");
  });

  it("marks seen and shows already-reviewed section", async () => {
    const user = userEvent.setup();
    const { markAllSeen } = await import("@/lib/seen");
    markAllSeen("2020-01-01T00:00:00.000Z");
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [
              makePr({
                repo: "acme/app",
                number: 13,
                title: "Needs review",
                updatedAt: "2026-09-04T12:00:00.000Z",
              }),
              pr,
            ],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-04T12:00:00.000Z")}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /Already reviewed/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Already reviewed \(/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mark seen/ }));
  });

  it("UNIT-PRLIST-001 keeps Mark seen on toolbar; Refresh with tabs row", async () => {
    const { markAllSeen } = await import("@/lib/seen");
    markAllSeen("2020-01-01T00:00:00.000Z");
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [
              makePr({
                repo: "acme/app",
                number: 99,
                title: "New PR",
                updatedAt: "2026-09-07T12:00:00.000Z",
              }),
            ],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-07T12:00:00.000Z")}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );

    const toolbar = screen.getByTestId("pr-list-toolbar");
    const actions = screen.getByTestId("pr-list-actions");
    const refreshRow = screen.getByTestId("pr-list-refresh-row");
    expect(actions).toHaveClass("flex-nowrap", "shrink-0");
    expect(actions).not.toHaveClass("flex-wrap");

    const markSeen = screen.getByRole("button", { name: /Mark seen/ });
    const refresh = screen.getByRole("button", { name: /Refresh/ });
    expect(actions).toContainElement(markSeen);
    expect(actions).not.toContainElement(refresh);
    expect(refreshRow).toContainElement(refresh);
    expect(refreshRow).toHaveTextContent(/Updated/);
    expect(toolbar).toContainElement(
      screen.getByRole("searchbox", { name: "Search pull requests" }),
    );
    expect(screen.getByRole("tab", { name: /Favorites/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All open/ })).toBeInTheDocument();
    expect(refreshRow).toContainElement(
      screen.getByRole("tablist", { name: "Pull request lists" }),
    );
    expect(toolbar).toContainElement(actions);
  });

  it("paginates long lists and shows stale banner", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: PR_LIST_PAGE_SIZE + 2 }, (_, i) =>
      makePr({
        repo: "acme/app",
        number: i + 1,
        title: `PR ${i + 1}`,
        updatedAt: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
      }),
    );
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: many,
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          stale
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-07T12:00:00.000Z")}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Showing a cached list/)).toBeInTheDocument();
    expect(screen.getByText(/1–25 of 27/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next page" });
    const prev = screen.getByRole("button", { name: "Previous page" });
    expect(prev).toBeDisabled();
    await user.click(next);
    expect(screen.getByText(/26–27 of 27/)).toBeInTheDocument();
    expect(next).toBeDisabled();
    await user.click(prev);
    expect(screen.getByText(/1–25 of 27/)).toBeInTheDocument();
  });

  it("shows People tab, search filter, author bar, and CI on rows", async () => {
    const user = userEvent.setup();
    mockUseSettings.mockReturnValue({
      refreshIntervalMin: 5,
      theme: "system",
      favoritesOnly: true,
      showFavoriteOpen: true,
      showFavoritePeople: true,
      aiProvider: "cursor",
    });
    mockUseFavoriteUsers.mockReturnValue([
      {
        login: "bob",
        name: "Bob",
        avatarUrl: "",
        htmlUrl: "https://github.com/bob",
        favoritedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const onAuthorChange = vi.fn();
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [
              makePr({
                repo: "acme/app",
                number: 50,
                title: "Searchable alpha",
                author: { login: "bob", avatarUrl: "" },
              }),
            ],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error="list unavailable"
          onRefresh={vi.fn()}
          updatedAt={new Date()}
          onSelect={vi.fn()}
          authorLogin="bob"
          authorMode="filter"
          onAuthorChange={onAuthorChange}
          searchLoading={false}
          ciFailures={{ "acme/app#50": "lint failed" }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("tab", { name: /People/ })).toBeInTheDocument();
    expect(screen.getByText("list unavailable")).toBeInTheDocument();
    expect(screen.getByText("lint failed")).toBeInTheDocument();
    await user.type(
      screen.getByRole("searchbox", { name: "Search pull requests" }),
      "alpha",
    );
    expect(screen.getByText("Searchable alpha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "bob" }));
    expect(onAuthorChange).toHaveBeenCalledWith("bob", "filter");
  });

  it("offers author search-all when filter has no matches", async () => {
    const user = userEvent.setup();
    const onAuthorChange = vi.fn();
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
          authorLogin="ghost"
          authorMode="filter"
          onAuthorChange={onAuthorChange}
        />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole("button", { name: /Show all PRs by @ghost/ }),
    );
    expect(onAuthorChange).toHaveBeenCalledWith("ghost", "search");
  });

  it("shows loading state and search mode items", () => {
    mockUseSettings.mockReturnValue({
      refreshIntervalMin: 5,
      theme: "system",
      favoritesOnly: true,
      showFavoriteOpen: true,
      showFavoritePeople: false,
      aiProvider: "cursor",
    });
    const searchPr = makePr({
      repo: "acme/search",
      number: 7,
      title: "From search",
    });
    const { rerender } = render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="all"
          onTabChange={vi.fn()}
          loading
          error={null}
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
          authorLogin="carol"
          authorMode="search"
          searchItems={[]}
          searchLoading
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading pull requests…")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="all"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
          authorLogin="carol"
          authorMode="search"
          searchItems={[searchPr]}
          searchLoading={false}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Open PRs by @carol/)).toBeInTheDocument();
    expect(screen.getByText("From search")).toBeInTheDocument();
  });

  it("uses amber error style when stale with error", () => {
    render(
      <MemoryRouter>
        <PRList
          lists={{
            all: [],
            favorites: [pr],
            assigned: [],
            review: [],
            reviewed: [],
            mine: [],
            people: [],
          }}
          active="favorites"
          onTabChange={vi.fn()}
          loading={false}
          error="GitHub rate limit — cached"
          stale
          onRefresh={vi.fn()}
          updatedAt={new Date()}
          onSelect={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/GitHub rate limit/)).toHaveClass(
      "text-on-warning-container",
    );
  });
});

describe("ChangedFilesPanel", () => {
  it("expands file diff and supports expand/collapse all", async () => {
    const user = userEvent.setup();
    render(
      <ChangedFilesPanel
        totals={{ add: 3, del: 1 }}
        files={[
          {
            filename: "src/a.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            changes: 4,
            patch: "@@ -1,1 +1,2 @@\n-old\n+new\n context",
          },
        ]}
      />,
    );
    expect(screen.getByText("Changed files (1)")).toBeInTheDocument();
    // First file is selected by default in the sidebar layout.
    expect(screen.getByText("new")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("new")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("adds RIGHT-side line comments to pending", async () => {
    const user = userEvent.setup();
    const onAddPending = vi.fn();
    render(
      <ChangedFilesPanel
        totals={{ add: 1, del: 0 }}
        onAddPending={onAddPending}
        files={[
          {
            filename: "src/a.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: "@@ -1,0 +1,1 @@\n+hello",
          },
        ]}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Add comment on line 1/ }),
    );
    await user.type(screen.getByPlaceholderText("Leave a comment…"), "nit");
    await user.click(screen.getByRole("button", { name: "Add to pending" }));
    expect(onAddPending).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "src/a.ts",
        line: 1,
        side: "RIGHT",
        body: "nit",
        source: "manual",
      }),
    );
  });

  it("cancels inline composer without adding pending", async () => {
    const user = userEvent.setup();
    const onAddPending = vi.fn();
    render(
      <ChangedFilesPanel
        totals={{ add: 1, del: 0 }}
        onAddPending={onAddPending}
        pendingComments={[
          {
            id: "p1",
            path: "src/a.ts",
            line: 1,
            side: "RIGHT",
            body: "existing",
            source: "manual",
          },
        ]}
        files={[
          {
            filename: "src/a.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: "@@ -1,0 +1,1 @@\n+hello",
          },
        ]}
      />,
    );
    expect(screen.getByText(/Pending · L1/)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Add comment on line 1/ }),
    );
    await user.type(screen.getByPlaceholderText("Leave a comment…"), "temp");
    await user.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(
      screen.queryByPlaceholderText("Leave a comment…"),
    ).not.toBeInTheDocument();
    expect(onAddPending).not.toHaveBeenCalled();
  });

  it("covers status labels, meta patch lines, and missing patch", async () => {
    const user = userEvent.setup();
    render(
      <ChangedFilesPanel
        totals={{ add: 1, del: 0 }}
        files={[
          {
            filename: "new.ts",
            status: "added",
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: "@@ -0,0 +1,1 @@\n+hi\n\\ No newline at end of file",
          },
          {
            filename: "gone.ts",
            status: "removed",
            additions: 0,
            deletions: 1,
            changes: 1,
            patch: "@@ -1,1 +0,0 @@\n-bye",
          },
          {
            filename: "renamed.ts",
            status: "renamed",
            additions: 0,
            deletions: 0,
            changes: 0,
            patch: "@@ junk hunk without nums",
          },
          {
            filename: "weird.ts",
            status: "copied",
            additions: 0,
            deletions: 0,
            changes: 0,
            patch: undefined,
          },
        ]}
      />,
    );
    expect(screen.getAllByText("Added").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Renamed")).toBeInTheDocument();
    expect(screen.getByText(/copied/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /new\.ts/ }));
    expect(screen.getByText(/No newline at end of file/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /weird\.ts/ }));
    expect(screen.getByText(/No patch available/)).toBeInTheDocument();
  });
});

describe("CiChecksPanel", () => {
  it("renders pending and neutral overall states", () => {
    render(
      <CiChecksPanel
        snapshot={{
          overall: "pending",
          sha: "abc",
          failedCount: 0,
          pendingCount: 1,
          successCount: 0,
          items: [
            {
              id: "p1",
              name: "deploy",
              state: "pending",
              description: "Running",
              targetUrl: null,
              source: "status",
              updatedAt: null,
            },
          ],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    expect(screen.getByText("Checks in progress")).toBeInTheDocument();
  });

  it("covers success/none overall, empty items, and open URL errors", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CiChecksPanel
        snapshot={{
          overall: "success",
          sha: "deadbeef",
          failedCount: 0,
          pendingCount: 0,
          successCount: 1,
          items: [
            {
              id: "ok",
              name: "tests",
              state: "success",
              description: "green",
              targetUrl: "https://ci.example/ok",
              source: "check_run",
              updatedAt: "2026-09-04T12:00:00.000Z",
              startedAt: "2026-09-04T11:59:00.000Z",
              completedAt: "2026-09-04T12:00:00.000Z",
              conclusion: "success",
            },
            {
              id: "none",
              name: "unknown",
              state: "none",
              description: "n/a",
              targetUrl: null,
              source: "status",
              updatedAt: null,
            },
          ],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        headBranch="feat/ci"
      />,
    );
    expect(screen.getAllByText("Passing").length).toBeGreaterThan(0);
    expect(screen.getByText("All checks passed")).toBeInTheDocument();
    expect(screen.getByText("feat/ci")).toBeInTheDocument();
    expect(screen.getByText(/Duration 1m/)).toBeInTheDocument();

    rerender(
      <CiChecksPanel
        snapshot={{
          overall: "none",
          sha: "abc",
          failedCount: 0,
          pendingCount: 0,
          successCount: 0,
          items: [],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("No checks")).toBeInTheDocument();
    expect(screen.getByText("No CI checks reported")).toBeInTheDocument();
    expect(
      screen.getByText("No CI statuses or check runs on this commit yet."),
    ).toBeInTheDocument();

    mockOpenUrl.mockRejectedValueOnce(new Error("opener down"));
    rerender(
      <CiChecksPanel
        snapshot={ciSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    await user.click(screen.getAllByRole("button", { name: "Open" })[0]!);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: opener down");
  });

  it("opens check URL from snapshot row", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(
      <CiChecksPanel
        snapshot={ciSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    const openButtons = screen.getAllByRole("button", { name: "Open" });
    await user.click(openButtons[0]!);
    expect(openUrl).toHaveBeenCalledWith("https://ci.example/build/1");
  });

  it("renders loading, error, and snapshot rows", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const { rerender } = render(
      <CiChecksPanel
        snapshot={null}
        loading
        error={null}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByText("Loading CI checks…")).toBeInTheDocument();

    rerender(
      <CiChecksPanel
        snapshot={ciSnapshot}
        loading={false}
        error="ci down"
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByText("ci down")).toBeInTheDocument();
    expect(screen.getAllByText("Failing").length).toBeGreaterThan(0);
    expect(screen.getByText("Some checks failed")).toBeInTheDocument();
    expect(screen.getByText("build")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("emphasizes cancelled checks without inventing metrics", () => {
    render(
      <CiChecksPanel
        snapshot={{
          overall: "failure",
          sha: "cafe123",
          failedCount: 1,
          pendingCount: 0,
          successCount: 0,
          items: [
            {
              id: "c1",
              name: "deploy-prod",
              state: "failure",
              description: "cancelled",
              targetUrl: null,
              source: "check_run",
              updatedAt: "2026-09-04T12:00:00.000Z",
              startedAt: "2026-09-04T11:50:00.000Z",
              completedAt: "2026-09-04T12:00:00.000Z",
              conclusion: "cancelled",
            },
          ],
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(screen.getByText("deploy-prod")).toBeInTheDocument();
    expect(screen.getByText(/Duration 10m/)).toBeInTheDocument();
  });
});

describe("ConversationPanel", () => {
  const panelPr = { repo: "acme/app", number: 42 };
  const ownComment = {
    id: 10,
    body: "My comment",
    user: "alice",
    avatarUrl: "https://avatar.example/alice.png",
    createdAt: "2026-09-04T11:00:00.000Z",
    updatedAt: "2026-09-04T11:00:00.000Z",
    htmlUrl: "https://github.com/c/10",
    isOwn: true,
  };
  const otherComment = {
    id: 11,
    body: "Their note",
    user: "bob",
    avatarUrl: "",
    createdAt: "2026-09-04T10:00:00.000Z",
    updatedAt: "2026-09-04T10:00:00.000Z",
    htmlUrl: "https://github.com/c/11",
    isOwn: false,
  };
  const templates = [
    { id: "lgtm", name: "LGTM", body: "Looks good to me!" },
    { id: "nit", name: "Nit", body: "Small suggestion" },
  ];
  const baseProps = {
    pr: panelPr,
    loading: false,
    error: null,
    templates,
    onPosted: vi.fn(),
    onUpdated: vi.fn(),
    onDeleted: vi.fn(),
  };

  beforeEach(() => {
    mockPostIssueComment.mockResolvedValue({
      id: 99,
      body: "New comment",
      user: "alice",
      avatarUrl: "",
      createdAt: "2026-09-04T12:00:00.000Z",
      updatedAt: "2026-09-04T12:00:00.000Z",
      htmlUrl: "https://github.com/c/99",
      isOwn: true,
    });
    mockUpdateIssueComment.mockResolvedValue({
      ...ownComment,
      body: "Updated text",
    });
    mockDeleteIssueComment.mockResolvedValue(undefined);
  });

  it("renders loading, error, and empty states", () => {
    const { rerender } = render(
      <ConversationPanel {...baseProps} comments={[]} loading />,
    );
    expect(screen.getByText("Loading comments…")).toBeInTheDocument();

    rerender(
      <ConversationPanel
        {...baseProps}
        comments={[]}
        loading={false}
        error="comments down"
      />,
    );
    expect(screen.getByText("comments down")).toBeInTheDocument();

    rerender(
      <ConversationPanel
        {...baseProps}
        comments={[]}
        loading={false}
        error={null}
      />,
    );
    expect(
      screen.getByText("No conversation comments yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("(0 comments)")).toBeInTheDocument();
  });

  it("posts comment and applies template", async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    render(
      <ConversationPanel
        {...baseProps}
        comments={[otherComment]}
        onPosted={onPosted}
      />,
    );
    expect(screen.getByText("(1 comment)")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "LGTM" }));
    expect(screen.getByPlaceholderText(/Leave a comment/)).toHaveValue(
      "Looks good to me!",
    );
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => {
      expect(mockPostIssueComment).toHaveBeenCalledWith(
        panelPr,
        "Looks good to me!",
      );
    });
    expect(onPosted).toHaveBeenCalled();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment posted");
  });

  it("surfaces post failure via toast.error", async () => {
    const user = userEvent.setup();
    mockPostIssueComment.mockRejectedValueOnce(new Error("rate limited"));
    render(<ConversationPanel {...baseProps} comments={[]} />);
    await user.type(
      screen.getByPlaceholderText(/Leave a comment/),
      "Will fail",
    );
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringMatching(/rate limit/i),
      );
    });
  });

  it("edits and deletes own comments", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const onDeleted = vi.fn();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(
      <ConversationPanel
        {...baseProps}
        comments={[ownComment]}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editBox = screen.getByLabelText("Edit comment");
    await user.clear(editBox);
    await user.type(editBox, "Updated text");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mockUpdateIssueComment).toHaveBeenCalledWith(
        panelPr,
        10,
        "Updated text",
      );
    });
    expect(onUpdated).toHaveBeenCalled();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment updated");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mockDeleteIssueComment).toHaveBeenCalledWith(panelPr, 10);
    });
    expect(onDeleted).toHaveBeenCalledWith(10);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment deleted");
    vi.unstubAllGlobals();
  });

  it("surfaces edit/delete failures and skips delete when cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    mockUpdateIssueComment.mockRejectedValueOnce(new Error("edit fail"));
    render(<ConversationPanel {...baseProps} comments={[ownComment]} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Edit comment"), " x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: edit fail");
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    mockDeleteIssueComment.mockRejectedValueOnce(new Error("delete fail"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: delete fail");
    });

    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    mockDeleteIssueComment.mockClear();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockDeleteIssueComment).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("disables writes when writeDisabled is true", async () => {
    const user = userEvent.setup();
    render(
      <ConversationPanel
        {...baseProps}
        comments={[ownComment]}
        writeDisabled
      />,
    );
    expect(
      screen.getByText(/Writes paused after a GitHub rate limit/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "LGTM" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Comment" }));
    expect(mockPostIssueComment).not.toHaveBeenCalled();
  });

  it("cancels edit mode without saving", async () => {
    const user = userEvent.setup();
    render(<ConversationPanel {...baseProps} comments={[ownComment]} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Edit comment"), " temp");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("My comment")).toBeInTheDocument();
    expect(mockUpdateIssueComment).not.toHaveBeenCalled();
  });

  it("skips post when body is whitespace-only and hides empty templates", async () => {
    const user = userEvent.setup();
    render(<ConversationPanel {...baseProps} comments={[]} templates={[]} />);
    expect(
      screen.queryByRole("button", { name: "LGTM" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Leave a comment/), "   ");
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Comment" }));
    expect(mockPostIssueComment).not.toHaveBeenCalled();
  });

  it("renders comment with avatar image", () => {
    const { container } = render(
      <ConversationPanel
        {...baseProps}
        comments={[
          {
            ...otherComment,
            avatarUrl: "https://avatar.example/bob.png",
          },
        ]}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://avatar.example/bob.png",
    );
  });
});

describe("CurrentReviewsPanel", () => {
  const reviewPr = { repo: "acme/app", number: 1 };
  const panelProps = {
    pr: reviewPr,
    onMutated: vi.fn(),
  };

  it("renders loading and error states", () => {
    const { rerender } = render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={null}
        loading
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Loading reviews from GitHub…"),
    ).toBeInTheDocument();
    rerender(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={null}
        loading={false}
        error="reviews down"
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("reviews down")).toBeInTheDocument();
  });

  it("renders dismissed review state and opens review link", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [
            {
              id: 2,
              user: "carol",
              avatarUrl: "",
              state: "DISMISSED",
              body: "",
              submittedAt: null,
              htmlUrl: "https://github.com/review/2",
              comments: [],
            },
          ],
          latestByUser: [],
          inlineCount: 0,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(openUrl).toHaveBeenCalledWith("https://github.com/review/2");
  });

  it("renders review cards, summary counts, and refresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={reviewsSnapshot}
        loading={false}
        error={null}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(screen.getByText("Current status")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("bob").length).toBeGreaterThan(0);
    expect(screen.getByText("Nice work")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("covers changes-requested, commented, unknown state, and empty list", () => {
    const { rerender } = render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [
            {
              id: 3,
              user: "dave",
              avatarUrl: "https://avatar.example/dave.png",
              state: "CHANGES_REQUESTED",
              body: "Please fix",
              submittedAt: "2026-09-04T10:00:00.000Z",
              htmlUrl: "https://github.com/review/3",
              comments: [
                {
                  id: 1,
                  path: "x.ts",
                  line: null,
                  body: "",
                  user: "dave",
                  avatarUrl: "",
                  createdAt: "2026-09-04T10:00:00.000Z",
                  htmlUrl: "https://github.com/c/1",
                  reviewId: 3,
                  inReplyToId: null,
                  isOwn: false,
                },
              ],
            },
            {
              id: 4,
              user: "erin",
              avatarUrl: "",
              state: "COMMENTED",
              body: "Note",
              submittedAt: "2026-09-04T09:00:00.000Z",
              htmlUrl: "https://github.com/review/4",
              comments: [],
            },
            {
              id: 5,
              user: "frank",
              avatarUrl: "",
              state: "UNKNOWN_STATE",
              body: "x",
              submittedAt: "2026-09-04T08:00:00.000Z",
              htmlUrl: "https://github.com/review/5",
              comments: [],
            },
          ],
          latestByUser: [
            {
              user: "dave",
              avatarUrl: "https://avatar.example/dave.png",
              state: "CHANGES_REQUESTED",
            },
            {
              user: "erin",
              avatarUrl: "",
              state: "COMMENTED",
            },
          ],
          inlineCount: 1,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Changes requested").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Commented").length).toBeGreaterThan(0);
    expect(screen.getByText("UNKNOWN_STATE")).toBeInTheDocument();
    rerender(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{ reviews: [], latestByUser: [], inlineCount: 0 }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("No review")).toBeInTheDocument();
    expect(screen.getByText("No reviews yet on this PR.")).toBeInTheDocument();
  });

  it("shows pending and dismissed reviewer states in summary", () => {
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [
            {
              id: 10,
              user: "gina",
              avatarUrl: "",
              state: "PENDING",
              body: "",
              submittedAt: null,
              htmlUrl: "https://github.com/review/10",
              comments: [],
            },
            {
              id: 11,
              user: "hank",
              avatarUrl: "",
              state: "DISMISSED",
              body: "stale",
              submittedAt: "2026-09-03T10:00:00.000Z",
              htmlUrl: "https://github.com/review/11",
              comments: [],
            },
          ],
          latestByUser: [
            { user: "gina", avatarUrl: "", state: "PENDING" },
            { user: "hank", avatarUrl: "", state: "DISMISSED" },
          ],
          inlineCount: 0,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dismissed").length).toBeGreaterThan(0);
  });

  const threadedReviewSnapshot: PrReviewsSnapshot = {
    reviews: [
      {
        id: 100,
        user: "alice",
        avatarUrl: "",
        state: "APPROVED",
        body: "LGTM",
        submittedAt: "2026-09-04T11:00:00.000Z",
        htmlUrl: "https://github.com/review/100",
        comments: [
          {
            id: 1,
            path: "src/main.ts",
            line: 5,
            body: "Fix this",
            user: "me",
            avatarUrl: "",
            createdAt: "2026-09-04T11:01:00.000Z",
            htmlUrl: "https://github.com/c/1",
            reviewId: 100,
            inReplyToId: null,
            isOwn: true,
          },
          {
            id: 2,
            path: "src/main.ts",
            line: 5,
            body: "Will do",
            user: "bob",
            avatarUrl: "",
            createdAt: "2026-09-04T11:02:00.000Z",
            htmlUrl: "https://github.com/c/2",
            reviewId: 100,
            inReplyToId: 1,
            isOwn: false,
          },
        ],
      },
    ],
    latestByUser: [{ user: "alice", avatarUrl: "", state: "APPROVED" }],
    inlineCount: 2,
  };

  beforeEach(() => {
    mockDismissReview.mockResolvedValue(undefined);
    mockUpdateReviewComment.mockResolvedValue(
      threadedReviewSnapshot.reviews[0]!.comments[0]!,
    );
    mockDeleteReviewComment.mockResolvedValue(undefined);
    mockReplyToReviewComment.mockResolvedValue(
      threadedReviewSnapshot.reviews[0]!.comments[0]!,
    );
  });

  it("requires dismiss message and confirms dismiss review", async () => {
    const user = userEvent.setup();
    const onMutated = vi.fn();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        onMutated={onMutated}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(
      screen.getByRole("button", { name: "Confirm dismiss" }),
    ).toBeDisabled();
    expect(mockDismissReview).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Dismiss message"),
      "Superseded by new commits",
    );
    await user.click(screen.getByRole("button", { name: "Confirm dismiss" }));
    await waitFor(() => {
      expect(mockDismissReview).toHaveBeenCalledWith(
        reviewPr,
        100,
        "Superseded by new commits",
      );
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Review dismissed");
    expect(onMutated).toHaveBeenCalled();
  });

  it("replies to, edits, and deletes own inline comments", async () => {
    const user = userEvent.setup();
    const onMutated = vi.fn();
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    render(
      <CurrentReviewsPanel
        {...panelProps}
        onMutated={onMutated}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Will do")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!);
    await user.type(screen.getByLabelText("Reply body"), "Thanks!");
    await user.click(screen.getByRole("button", { name: "Post reply" }));
    await waitFor(() => {
      expect(mockReplyToReviewComment).toHaveBeenCalledWith(
        reviewPr,
        1,
        "Thanks!",
      );
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Reply posted");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const editBox = screen.getByDisplayValue("Fix this");
    await user.clear(editBox);
    await user.type(editBox, "Please fix");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mockUpdateReviewComment).toHaveBeenCalledWith(
        reviewPr,
        1,
        "Please fix",
      );
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment updated");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirmSpy).toHaveBeenCalledWith("Delete this review comment?");
    await waitFor(() => {
      expect(mockDeleteReviewComment).toHaveBeenCalledWith(reviewPr, 1);
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment deleted");
    vi.unstubAllGlobals();
  });

  it("skips delete when confirm is cancelled", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockDeleteReviewComment).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("renders nested reply threads with indent", () => {
    const { container } = render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    expect(screen.getByText("Fix this")).toBeInTheDocument();
    expect(screen.getByText("Will do")).toBeInTheDocument();
    expect(container.querySelector(".ml-4")).toBeTruthy();
  });

  it("disables write actions when writeDisabled is true", async () => {
    const user = userEvent.setup();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        writeDisabled
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Reply" })[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByLabelText("Dismiss message")).not.toBeInTheDocument();
    expect(mockDismissReview).not.toHaveBeenCalled();
  });

  it("surfaces dismiss, reply, edit, and delete failures", async () => {
    const user = userEvent.setup();
    mockDismissReview.mockRejectedValueOnce(new Error("dismiss fail"));
    mockReplyToReviewComment.mockRejectedValueOnce(new Error("reply fail"));
    mockUpdateReviewComment.mockRejectedValueOnce(new Error("edit fail"));
    mockDeleteReviewComment.mockRejectedValueOnce(new Error("delete fail"));
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await user.type(screen.getByLabelText("Dismiss message"), "Stale review");
    await user.click(screen.getByRole("button", { name: "Confirm dismiss" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: dismiss fail",
      );
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!);
    await user.type(screen.getByLabelText("Reply body"), "oops");
    await user.click(screen.getByRole("button", { name: "Post reply" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: reply fail");
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByDisplayValue("Fix this"), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: edit fail");
    });
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: delete fail");
    });
    vi.unstubAllGlobals();
  });

  it("requires dismiss message and cancels dismiss/reply/edit flows", async () => {
    const user = userEvent.setup();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(
      screen.getByRole("button", { name: "Confirm dismiss" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Dismiss message")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!);
    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]!);
    expect(screen.queryByLabelText("Reply body")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Fix this")).toBeInTheDocument();
  });

  it("opens inline comment on GitHub and shows empty comment body", async () => {
    const user = userEvent.setup();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [
            {
              id: 200,
              user: "zoe",
              avatarUrl: "",
              state: "COMMENTED",
              body: "",
              submittedAt: null,
              htmlUrl: "https://github.com/review/200",
              comments: [
                {
                  id: 50,
                  path: "src/x.ts",
                  line: null,
                  body: "",
                  user: "zoe",
                  avatarUrl: "",
                  createdAt: "2026-09-04T11:00:00.000Z",
                  htmlUrl: "https://github.com/c/50",
                  reviewId: 200,
                  inReplyToId: null,
                  isOwn: false,
                },
              ],
            },
          ],
          latestByUser: [{ user: "zoe", avatarUrl: "", state: "COMMENTED" }],
          inlineCount: 1,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    expect(screen.getByText("(empty comment)")).toBeInTheDocument();
    expect(screen.getByText("No review summary body.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "GitHub" }));
    expect(mockOpenUrl).toHaveBeenCalledWith("https://github.com/c/50");
  });

  it("falls back to no review when latest states are unrecognized", () => {
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [],
          latestByUser: [{ user: "ghost", avatarUrl: "", state: "UNKNOWN" }],
          inlineCount: 0,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    expect(screen.getAllByText("No review").length).toBeGreaterThan(0);
  });

  it("cancels reply on nested inline comment", async () => {
    const user = userEvent.setup();
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={threadedReviewSnapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    const replyButtons = screen.getAllByRole("button", { name: "Reply" });
    await user.click(replyButtons[1]!);
    expect(screen.getByLabelText("Reply body")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Reply body")).not.toBeInTheDocument();
  });

  it("shows all-dismissed overall status and reviewer avatar fallback", () => {
    render(
      <CurrentReviewsPanel
        {...panelProps}
        snapshot={{
          reviews: [
            {
              id: 300,
              user: "y",
              avatarUrl: "",
              state: "DISMISSED",
              body: "gone",
              submittedAt: "2026-09-04T08:00:00.000Z",
              htmlUrl: "https://github.com/review/300",
              comments: [],
            },
          ],
          latestByUser: [{ user: "y", avatarUrl: "", state: "DISMISSED" }],
          inlineCount: 0,
        }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onMutated={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Dismissed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Y").length).toBeGreaterThan(0);
  });
});

describe("PRDetailDrawer", () => {
  beforeEach(() => {
    mockFetchPrDetail.mockResolvedValue({
      ...pendingPr,
      body: "PR description",
      headSha: "deadbeef",
      nodeId: "PR_1",
      mergedAt: null,
      additions: 5,
      deletions: 2,
      changedFiles: 1,
      reviewers: ["bob"],
      ciStatus: "success",
      ciDescription: "All checks passed",
    });
    mockSubmitReview.mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  });

  it("loads detail when open and shows actions", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    expect(
      screen.getByText("CI · success — All checks passed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open AI review screen/ }),
    ).toHaveAttribute("href", "/review/acme/app/13");
    await user.click(screen.getByRole("button", { name: "LGTM" }));
    expect(screen.getByRole("textbox")).toHaveValue("Looks good!");
  });

  it("submits approve review and closes drawer", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(pendingPr, "APPROVE", "");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits request changes and handles copy/open actions", async () => {
    const user = userEvent.setup();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    await user.type(screen.getByRole("textbox"), "Please address");
    await user.click(screen.getByRole("button", { name: "Request changes" }));
    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        pendingPr,
        "REQUEST_CHANGES",
        "Please address",
      );
    });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await user.click(screen.getByRole("button", { name: "Open in browser" }));
    expect(openUrl).toHaveBeenCalledWith(pendingPr.url);
  });

  it("handles fetch failure, comment submit, and close-on-AI-link", async () => {
    mockFetchPrDetail.mockRejectedValueOnce(new Error("detail boom"));
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: detail boom");
    });
  });

  it("submits comment review and closes via AI review link", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    await user.type(screen.getByRole("textbox"), "nit");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        pendingPr,
        "COMMENT",
        "nit",
      );
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Commented");

    // Re-open path for AI link close
    mockFetchPrDetail.mockResolvedValueOnce({
      ...pendingPr,
      body: "again",
      headSha: "abc",
      nodeId: "PR_3",
      mergedAt: null,
      additions: 1,
      deletions: 0,
      changedFiles: 1,
      reviewers: [],
      ciStatus: "pending",
      ciDescription: "running",
    });
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={onOpenChange} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("again")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("link", { name: /Open AI review screen/ }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles copy and open failures in drawer", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("nope"),
    );
    mockOpenUrl.mockRejectedValueOnce(new Error("blocked"));
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Could not copy link");
    await user.click(screen.getByRole("button", { name: "Open in browser" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: blocked");

    render(
      <MemoryRouter>
        <PRDetailDrawer pr={null} open={false} onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
  });

  it("surfaces submit review errors", async () => {
    const user = userEvent.setup();
    mockSubmitReview.mockRejectedValueOnce(new Error("submit fail"));
    render(
      <MemoryRouter>
        <PRDetailDrawer pr={pendingPr} open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("PR description")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: submit fail");
    });
  });
});
