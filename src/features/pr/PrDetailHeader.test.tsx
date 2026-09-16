import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

import { PrDetailHeader } from "./PrDetailHeader";

const openUrl = vi.fn();

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrl(...args),
}));

describe("PrDetailHeader", () => {
  beforeEach(() => {
    openUrl.mockReset();
    openUrl.mockResolvedValue(undefined);
  });

  it("opens GitHub and toggles branch favorite", async () => {
    const user = userEvent.setup();
    const onQuickApprove = vi.fn();
    const onToggleBranchFavorite = vi.fn();
    render(
      <MemoryRouter>
        <PrDetailHeader
          owner="acme"
          repo="app"
          prNumber={7}
          detail={{
            id: 7,
            number: 7,
            repo: "acme/app",
            title: "Header PR",
            url: "https://github.com/acme/app/pull/7",
            state: "open",
            isDraft: false,
            body: "",
            author: { login: "alice", avatarUrl: "" },
            createdAt: "2026-09-01T10:00:00.000Z",
            updatedAt: "2026-09-01T12:00:00.000Z",
            headBranch: "feat/h",
            baseBranch: "main",
            headSha: "sha",
            nodeId: "PR_7",
            mergedAt: null,
            additions: 1,
            deletions: 0,
            changedFiles: 1,
            reviewers: [],
            ciStatus: "none",
            ciDescription: "",
          }}
          pr={makePr({ number: 7, repo: "acme/app", title: "Header PR" })}
          yourReviewEvent="COMMENT"
          githubMyReview={{ user: "me", state: "COMMENTED" }}
          localSavedReview={undefined}
          branchStarred={false}
          approving={false}
          posting={false}
          onQuickApprove={onQuickApprove}
          onToggleBranchFavorite={onToggleBranchFavorite}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Header PR")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open on GitHub/ }));
    expect(openUrl).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Favorite branch/ }));
    expect(onToggleBranchFavorite).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Approve LGTM/ }));
    expect(onQuickApprove).toHaveBeenCalled();
  });
});
