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

vi.mock("@/features/pr/api", () => ({
  fetchHeadBranch: vi.fn(),
  fetchPrDetail: vi.fn(),
  submitReview: vi.fn(),
}));

vi.mock("@/lib/use-settings", () => ({
  useFavoriteBranches: vi.fn(() => []),
  useTemplates: vi.fn(() => [
    { id: "lgtm", name: "LGTM", body: "Looks good!" },
  ]),
}));

import { openUrl } from "@tauri-apps/plugin-opener";

import {
  fetchHeadBranch,
  fetchPrDetail,
  submitReview,
} from "@/features/pr/api";

import { ChangedFilesPanel } from "./ChangedFilesPanel";
import { CiChecksPanel } from "./CiChecksPanel";
import { CurrentReviewsPanel } from "./CurrentReviewsPanel";
import { PRDetailDrawer } from "./PRDetailDrawer";
import { PRList } from "./PRList";
import { PRRow } from "./PRRow";
import type { CiChecksSnapshot, PrReviewsSnapshot } from "./types";

const mockFetchHeadBranch = vi.mocked(fetchHeadBranch);
const mockFetchPrDetail = vi.mocked(fetchPrDetail);
const mockSubmitReview = vi.mocked(submitReview);
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
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  });

  it("renders PR metadata and handles select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PRRow pr={pendingPr} onSelect={onSelect} isNew />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Needs review/ }));
    expect(onSelect).toHaveBeenCalledWith(pendingPr);
  });

  it("shows reviewed state and favorite branch badge", () => {
    render(<PRRow pr={pr} onSelect={vi.fn()} />);
    expect(screen.getByText(/Reviewed · Approved/)).toBeInTheDocument();
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
    expect(
      screen.getByText(/Reviewed · Changes requested/),
    ).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
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
    expect(screen.getByText(/Reviewed · Commented/)).toBeInTheDocument();

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
});

describe("PRList", () => {
  it("renders tabs, empty state, and PR rows", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <MemoryRouter>
        <PRList
          lists={{ assigned: [], review: [pendingPr], mine: [pr] }}
          active="review"
          onTabChange={onTabChange}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-04T12:00:00.000Z")}
          onSelect={onSelect}
          favoritesOnly={false}
          onFavoritesOnlyChange={vi.fn()}
          favoriteCount={2}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("tab", { name: /Review requested/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: /My open/ }));
    expect(onTabChange).toHaveBeenCalledWith("mine");
    await user.click(screen.getByRole("button", { name: /Needs review/ }));
    expect(onSelect).toHaveBeenCalledWith(pendingPr);
  });

  it("shows error and favorites-only empty message", () => {
    render(
      <MemoryRouter>
        <PRList
          lists={{ assigned: [], review: [], mine: [] }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error="boom"
          onRefresh={vi.fn()}
          updatedAt={null}
          onSelect={vi.fn()}
          favoritesOnly
          onFavoritesOnlyChange={vi.fn()}
          favoriteCount={1}
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
            mine: [],
          }}
          active="review"
          onTabChange={vi.fn()}
          loading={false}
          error={null}
          onRefresh={vi.fn()}
          updatedAt={new Date("2026-09-04T12:00:00.000Z")}
          onSelect={vi.fn()}
          favoritesOnly={false}
          onFavoritesOnlyChange={vi.fn()}
          favoriteCount={0}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Already reviewed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mark seen/ }));
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
    await user.click(screen.getByRole("button", { name: /src\/a.ts/ }));
    expect(screen.getByText("new")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("new")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText("new")).toBeInTheDocument();
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
    expect(screen.getByText("Added")).toBeInTheDocument();
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
      />,
    );
    expect(screen.getByText("All checks passed")).toBeInTheDocument();

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
    expect(screen.getByText("Some checks failed")).toBeInTheDocument();
    expect(screen.getByText("build")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe("CurrentReviewsPanel", () => {
  it("renders loading and error states", () => {
    const { rerender } = render(
      <CurrentReviewsPanel
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

  it("renders review cards and refresh", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <CurrentReviewsPanel
        snapshot={reviewsSnapshot}
        loading={false}
        error={null}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getAllByText("bob").length).toBeGreaterThan(0);
    expect(screen.getByText("Nice work")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("covers changes-requested, commented, unknown state, and empty list", () => {
    const { rerender } = render(
      <CurrentReviewsPanel
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
                },
              ],
            },
            {
              id: 4,
              user: "erin",
              avatarUrl: "",
              state: "COMMENTED",
              body: "note",
              submittedAt: "2026-09-04T11:00:00.000Z",
              htmlUrl: "https://github.com/review/4",
              comments: [],
            },
            {
              id: 5,
              user: "frank",
              avatarUrl: "",
              state: "PENDING",
              body: "",
              submittedAt: null,
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
            { user: "erin", avatarUrl: "", state: "COMMENTED" },
            { user: "frank", avatarUrl: "", state: "PENDING" },
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
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getByText("(empty comment)")).toBeInTheDocument();

    rerender(
      <CurrentReviewsPanel
        snapshot={{ reviews: [], latestByUser: [], inlineCount: 0 }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.getByText("No reviews yet on this PR.")).toBeInTheDocument();
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
