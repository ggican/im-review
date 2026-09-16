import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { GmailMessageRow } from "./GmailMessageRow";
import type { GmailMessageSummary } from "./types";

const baseMessage: GmailMessageSummary = {
  id: "msg-1",
  threadId: "thr-1",
  subject: "Review PR",
  from: "Bob <bob@example.com>",
  snippet: "Please review",
  date: "2026-01-01T00:00:00.000Z",
  dateMs: Date.parse("2026-01-01T00:00:00.000Z"),
  labelIds: ["INBOX"],
  unread: false,
  starred: false,
};

function renderRow(
  message: GmailMessageSummary,
  props?: Partial<ComponentProps<typeof GmailMessageRow>>,
) {
  return render(
    <MemoryRouter>
      <ul>
        <GmailMessageRow message={message} {...props} />
      </ul>
    </MemoryRouter>,
  );
}

describe("GmailMessageRow", () => {
  it("shows unread and important badges", () => {
    renderRow({
      ...baseMessage,
      unread: true,
      labelIds: ["UNREAD", "IMPORTANT", "INBOX"],
    });
    expect(screen.getByText("Unread")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
  });

  it("shows important badge for CATEGORY_PERSONAL", () => {
    renderRow({
      ...baseMessage,
      labelIds: ["CATEGORY_PERSONAL", "INBOX"],
    });
    expect(screen.getByText("Important")).toBeInTheDocument();
  });

  it("calls onToggleStar without navigating when star is clicked", async () => {
    const user = userEvent.setup();
    const onToggleStar = vi.fn();
    renderRow({ ...baseMessage, starred: true }, { onToggleStar });

    await user.click(screen.getByRole("button", { name: "Unstar message" }));

    expect(onToggleStar).toHaveBeenCalledWith(
      expect.objectContaining({ id: "msg-1" }),
    );
  });

  it("omits star button when no handler is provided", () => {
    renderRow(baseMessage);
    expect(screen.queryByRole("button", { name: /Star message/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Unstar message/ })).toBeNull();
  });
});
