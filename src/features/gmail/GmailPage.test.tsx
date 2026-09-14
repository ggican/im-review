import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import { fetchGmailLabels, fetchGmailMessages } from "./api";
import { GmailPage } from "./GmailPage";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchGmailLabels: vi.fn().mockResolvedValue([]),
    fetchGmailMessages: vi.fn().mockResolvedValue({
      messages: [],
      nextPageToken: null,
    }),
  };
});

function renderGmail() {
  return render(
    <MemoryRouter>
      <GmailPage />
    </MemoryRouter>,
  );
}

describe("GmailPage", () => {
  beforeEach(() => {
    saveGooglePublic(null);
    vi.mocked(fetchGmailMessages).mockClear();
    vi.mocked(fetchGmailLabels).mockClear();
  });

  it("prompts to connect when Google is not linked", () => {
    renderGmail();
    expect(screen.getByRole("heading", { name: "Gmail" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("loads unread tab by default when connected", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessages).mockResolvedValue({
      messages: [
        {
          id: "m1",
          threadId: "t1",
          subject: "Review please",
          from: "Bob",
          snippet: "Can you review?",
          date: "2026-01-01T00:00:00.000Z",
          dateMs: Date.parse("2026-01-01T00:00:00.000Z"),
          labelIds: ["UNREAD", "INBOX"],
          unread: true,
          starred: false,
        },
      ],
      nextPageToken: null,
    });
    renderGmail();
    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "unread" }),
      );
    });
    expect(screen.getByText("Review please")).toBeInTheDocument();
  });

  it("switches tabs and applies search", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    renderGmail();
    await waitFor(() => expect(fetchGmailMessages).toHaveBeenCalled());

    await user.click(screen.getByRole("tab", { name: "Sent" }));
    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "sent" }),
      );
    });

    await user.type(
      screen.getByRole("textbox", { name: "Gmail search" }),
      "from:ci@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenCalledWith(
        expect.objectContaining({ search: "from:ci@example.com" }),
      );
    });
  });
});
