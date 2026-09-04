import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiReviewDraft } from "./types";

import { AiReviewPanel } from "./AiReviewPanel";

const draft: AiReviewDraft = {
  prKey: "acme/app#42",
  summary: "Summary text",
  suggestedEvent: "COMMENT",
  rawText: "",
  createdAt: "2026-09-04T12:00:00.000Z",
  findings: [
    {
      id: "f1",
      severity: "warning",
      title: "Missing test",
      body: "Add coverage",
      path: "src/a.ts",
      line: 10,
      included: true,
    },
    {
      id: "f2",
      severity: "info",
      title: "Nit",
      body: "Rename",
      included: false,
    },
  ],
};

describe("AiReviewPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances generating timer", () => {
    vi.useFakeTimers();
    render(
      <AiReviewPanel
        generating
        posting={false}
        draft={null}
        onSummaryChange={vi.fn()}
        onToggleFinding={vi.fn()}
        onEventChange={vi.fn()}
        onCancel={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    expect(screen.getByText(/0s/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/3s/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows generating state with cancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AiReviewPanel
        generating
        posting={false}
        draft={null}
        onSummaryChange={vi.fn()}
        onToggleFinding={vi.fn()}
        onEventChange={vi.fn()}
        onCancel={onCancel}
        onPost={vi.fn()}
      />,
    );
    expect(screen.getByText(/Cursor AI is reviewing/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel waiting" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("returns null when not generating and no draft", () => {
    const { container } = render(
      <AiReviewPanel
        generating={false}
        posting={false}
        draft={null}
        onSummaryChange={vi.fn()}
        onToggleFinding={vi.fn()}
        onEventChange={vi.fn()}
        onCancel={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("edits draft, toggles findings, changes event, posts, and discards", async () => {
    const user = userEvent.setup();
    const onSummaryChange = vi.fn();
    const onToggleFinding = vi.fn();
    const onEventChange = vi.fn();
    const onPost = vi.fn();
    const onCancel = vi.fn();

    render(
      <AiReviewPanel
        generating={false}
        posting={false}
        draft={draft}
        onSummaryChange={onSummaryChange}
        onToggleFinding={onToggleFinding}
        onEventChange={onEventChange}
        onCancel={onCancel}
        onPost={onPost}
      />,
    );

    expect(screen.getByText("AI review draft")).toBeInTheDocument();
    expect(screen.getByText("Findings (1/2 selected)")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts:10")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Summary"));
    await user.type(screen.getByLabelText("Summary"), "Updated");
    expect(onSummaryChange).toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /Include Missing test/ }));
    expect(onToggleFinding).toHaveBeenCalledWith("f1");

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onEventChange).toHaveBeenCalledWith("APPROVE");

    await user.click(screen.getByRole("button", { name: "Post review to GitHub" }));
    expect(onPost).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables controls while posting", () => {
    render(
      <AiReviewPanel
        generating={false}
        posting
        draft={draft}
        onSummaryChange={vi.fn()}
        onToggleFinding={vi.fn()}
        onEventChange={vi.fn()}
        onCancel={vi.fn()}
        onPost={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Summary")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Post review to GitHub" })).toBeDisabled();
  });
});
