import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("./api", () => ({
  postIssueComment: vi.fn(),
}));

import { toast } from "sonner";

import { postIssueComment } from "./api";
import { ConversationPanel } from "./ConversationPanel";
import { PendingReviewBar } from "./PendingReviewBar";

const mockPost = vi.mocked(postIssueComment);

describe("ConversationPanel", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("lists comments, applies template, and posts", async () => {
    const user = userEvent.setup();
    const onPosted = vi.fn();
    mockPost.mockResolvedValue({
      id: 7,
      body: "Looks good!",
      user: "alice",
      avatarUrl: "",
      createdAt: "2026-09-04T12:00:00.000Z",
      updatedAt: "2026-09-04T12:00:00.000Z",
      htmlUrl: "https://github.com/c/7",
      isOwn: true,
    });

    render(
      <ConversationPanel
        pr={{ repo: "acme/app", number: 1 }}
        comments={[
          {
            id: 1,
            body: "Earlier note",
            user: "bob",
            avatarUrl: "",
            createdAt: "2026-09-03T12:00:00.000Z",
            updatedAt: "2026-09-03T12:00:00.000Z",
            htmlUrl: "https://github.com/c/1",
            isOwn: false,
          },
        ]}
        loading={false}
        error={null}
        templates={[{ id: "lgtm", name: "LGTM", body: "Looks good!" }]}
        onPosted={onPosted}
      />,
    );

    expect(screen.getByText("Earlier note")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "LGTM" }));
    expect(screen.getByRole("textbox")).toHaveValue("Looks good!");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        { repo: "acme/app", number: 1 },
        "Looks good!",
      );
    });
    expect(onPosted).toHaveBeenCalled();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Comment posted");
  });

  it("surfaces writeDisabled state in conversation compose", () => {
    render(
      <ConversationPanel
        pr={{ repo: "acme/app", number: 1 }}
        comments={[]}
        loading
        error="GitHub rate limit — tunggu"
        templates={[]}
        writeDisabled
        onPosted={vi.fn()}
      />,
    );
    expect(screen.getByText(/Loading comments/)).toBeInTheDocument();
    expect(screen.getByText("GitHub rate limit — tunggu")).toBeInTheDocument();
    expect(
      screen.getByText(/Writes paused after a GitHub rate limit/),
    ).toBeInTheDocument();
  });

  it("surfaces rate-limit errors without retry", async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValue(new Error("secondary rate limit exceeded"));
    render(
      <ConversationPanel
        pr={{ repo: "acme/app", number: 1 }}
        comments={[]}
        loading={false}
        error={null}
        templates={[]}
        onPosted={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox"), "hi");
    await user.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        expect.stringMatching(/rate limit/i),
      );
    });
  });
});

describe("PendingReviewBar", () => {
  it("renders pending and submits", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onRemove = vi.fn();
    const onBodyChange = vi.fn();
    const onEventChange = vi.fn();
    render(
      <PendingReviewBar
        pending={[
          {
            id: "p1",
            path: "a.ts",
            line: 2,
            side: "RIGHT",
            body: "rename",
            source: "manual",
          },
        ]}
        event="APPROVE"
        body="LGTM"
        isDraft={false}
        submitting={false}
        onEventChange={onEventChange}
        onBodyChange={onBodyChange}
        onRemove={onRemove}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText(/Pending review \(1\)/)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Optional summary/), " more");
    expect(onBodyChange).toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("Review event"), "COMMENT");
    expect(onEventChange).toHaveBeenCalledWith("COMMENT");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledWith("p1");
    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("warns when approving a draft PR", () => {
    render(
      <PendingReviewBar
        pending={[
          {
            id: "p1",
            path: "a.ts",
            line: 2,
            side: "RIGHT",
            body: "x",
            source: "manual",
          },
        ]}
        event="APPROVE"
        body=""
        isDraft
        submitting={false}
        onEventChange={vi.fn()}
        onBodyChange={vi.fn()}
        onRemove={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Draft PRs cannot be approved/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit review" }),
    ).toBeDisabled();
  });

  it("hides when empty", () => {
    const { container } = render(
      <PendingReviewBar
        pending={[]}
        event="COMMENT"
        body=""
        isDraft={false}
        submitting={false}
        onEventChange={vi.fn()}
        onBodyChange={vi.fn()}
        onRemove={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
