import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

import { PrDetailTab } from "./PrDetailTab";
import type { CiChecksSnapshot, PrDetail, PrReviewsSnapshot } from "./types";

const detail = (overrides: Partial<PrDetail> = {}): PrDetail => ({
  id: 1,
  number: 1,
  repo: "acme/app",
  title: "Detail PR",
  url: "https://github.com/acme/app/pull/1",
  state: "open",
  isDraft: false,
  body: "Hello body",
  author: { login: "alice", avatarUrl: "https://example.com/a.png" },
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  headBranch: "feat/x",
  baseBranch: "main",
  headSha: "abc123",
  nodeId: "PR_1",
  mergedAt: null,
  additions: 10,
  deletions: 2,
  changedFiles: 3,
  reviewers: ["bob"],
  ciStatus: "success",
  ciDescription: "All good",
  ...overrides,
});

const emptyReviews: PrReviewsSnapshot = {
  reviews: [],
  latestByUser: [],
  inlineCount: 0,
};

const ciOk: CiChecksSnapshot = {
  overall: "success",
  sha: "abc",
  items: [],
  failedCount: 0,
  pendingCount: 0,
  successCount: 1,
};

function renderTab(props: Partial<Parameters<typeof PrDetailTab>[0]> = {}) {
  const setApproveBody = vi.fn();
  const onQuickApprove = vi.fn();
  const onSetConfirmAction = vi.fn();
  const onMarkReady = vi.fn();
  const onReopen = vi.fn();
  const onOpenCiTab = vi.fn();
  render(
    <PrDetailTab
      detail={detail()}
      pr={makePr({ number: 1, repo: "acme/app" })}
      files={[
        {
          filename: "a.ts",
          status: "modified",
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: "",
        },
        {
          filename: "b.ts",
          status: "modified",
          additions: 2,
          deletions: 1,
          changes: 3,
          patch: "",
        },
      ]}
      reviews={{
        reviews: [],
        latestByUser: [
          { user: "bob", state: "APPROVED", avatarUrl: "" },
          {
            user: "carol",
            state: "CHANGES_REQUESTED",
            avatarUrl: "https://x/c.png",
          },
          { user: "dan", state: "COMMENTED", avatarUrl: "" },
          { user: "erin", state: "PENDING", avatarUrl: "" },
        ],
        inlineCount: 0,
      }}
      ci={ciOk}
      canManageOwnPr={false}
      ownerAction={null}
      approving={false}
      posting={false}
      approveBody="LGTM"
      setApproveBody={setApproveBody}
      templates={[{ id: "t1", name: "Ship", body: "Ship it" }]}
      onQuickApprove={onQuickApprove}
      onSetConfirmAction={onSetConfirmAction}
      onMarkReady={onMarkReady}
      onReopen={onReopen}
      onOpenCiTab={onOpenCiTab}
      {...props}
    />,
  );
  return {
    setApproveBody,
    onQuickApprove,
    onSetConfirmAction,
    onMarkReady,
    onReopen,
    onOpenCiTab,
  };
}

describe("PrDetailTab", () => {
  it("renders description, files, reviewer badges, and template chips", async () => {
    const user = userEvent.setup();
    const { setApproveBody, onQuickApprove, onOpenCiTab } = renderTab({
      yourReviewEvent: "APPROVE",
    });

    expect(screen.getByText("Hello body")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("Commented")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ship" }));
    expect(setApproveBody).toHaveBeenCalledWith("Ship it");

    await user.click(
      screen.getByRole("button", { name: /Approve & submit to GitHub/ }),
    );
    expect(onQuickApprove).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /success/i }));
    expect(onOpenCiTab).toHaveBeenCalled();
  });

  it("shows empty description and not-reviewed state", () => {
    renderTab({
      detail: detail({ body: "  ", reviewers: [] }),
      reviews: emptyReviews,
      yourReviewEvent: undefined,
      files: [],
    });
    expect(screen.getByText("No description.")).toBeInTheDocument();
    expect(screen.getByText("Not reviewed yet")).toBeInTheDocument();
    expect(screen.getByText("None listed")).toBeInTheDocument();
    expect(screen.getByText("No file list loaded yet.")).toBeInTheDocument();
  });

  it("shows draft warning, owner controls, and more files hint", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, i) => ({
      filename: `f${i}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "",
    }));
    const { onSetConfirmAction, onMarkReady } = renderTab({
      detail: detail({ isDraft: true }),
      pr: makePr({ number: 1, repo: "acme/app", isDraft: true }),
      files: many,
      yourReviewEvent: "REQUEST_CHANGES",
      canManageOwnPr: true,
    });
    expect(
      screen.getByText(/Draft PRs cannot be approved/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\+2 more in Files tab/)).toBeInTheDocument();
    expect(screen.getByText("Changes requested")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Mark ready for review/ }),
    );
    expect(onMarkReady).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Close PR/ }));
    expect(onSetConfirmAction).toHaveBeenCalledWith("close");
  });

  it("reopens closed PR", async () => {
    const user = userEvent.setup();
    const { onReopen } = renderTab({
      detail: detail({ state: "closed" }),
      pr: makePr({ number: 1, repo: "acme/app", state: "closed" }),
      canManageOwnPr: true,
    });
    await user.click(screen.getByRole("button", { name: /Reopen/i }));
    expect(onReopen).toHaveBeenCalled();
  });

  it("converts open PR to draft", async () => {
    const user = userEvent.setup();
    const { onSetConfirmAction } = renderTab({
      detail: detail({ isDraft: false, state: "open" }),
      canManageOwnPr: true,
    });
    await user.click(screen.getByRole("button", { name: /Convert to draft/ }));
    expect(onSetConfirmAction).toHaveBeenCalledWith("draft");
  });
});
