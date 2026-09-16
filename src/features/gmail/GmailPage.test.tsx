import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import { fetchGmailLabels, fetchGmailMessages, starGmailMessage } from "./api";
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
    starGmailMessage: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

function renderGmail() {
  return render(
    <MemoryRouter>
      <GmailPage />
    </MemoryRouter>,
  );
}

const sampleMessage = {
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
};

describe("GmailPage", () => {
  beforeEach(() => {
    saveGooglePublic(null);
    vi.mocked(fetchGmailMessages).mockClear();
    vi.mocked(fetchGmailLabels).mockClear();
    vi.mocked(starGmailMessage).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(fetchGmailMessages).mockResolvedValue({
      messages: [],
      nextPageToken: null,
    });
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
      messages: [sampleMessage],
      nextPageToken: null,
    });
    renderGmail();
    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenCalledWith(
        expect.objectContaining({ tab: "unread" }),
      );
    });
    expect(screen.getByText("Review please")).toBeInTheDocument();
    expect(screen.getByLabelText("Star message")).toBeInTheDocument();
  });

  it("shows empty unread copy when the list is empty", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    renderGmail();
    expect(await screen.findByText("No unread messages.")).toBeInTheDocument();
  });

  it("shows tab-specific empty copy", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    renderGmail();
    await waitFor(() => expect(fetchGmailMessages).toHaveBeenCalled());

    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    expect(
      await screen.findByText("No messages in inbox."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Starred" }));
    expect(await screen.findByText("No starred messages.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Sent" }));
    expect(
      await screen.findByText("No sent messages match this view."),
    ).toBeInTheDocument();
  });

  it("shows search empty copy", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    renderGmail();
    await waitFor(() => expect(fetchGmailMessages).toHaveBeenCalled());

    await user.type(
      screen.getByRole("textbox", { name: "Gmail search" }),
      "from:nobody",
    );
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("No search results.")).toBeInTheDocument();
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

  it("shows reconnect banner on scope errors", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessages).mockRejectedValue(
      new Error("403 insufficient scope"),
    );
    renderGmail();
    expect(
      await screen.findByRole("link", { name: "Reconnect Google" }),
    ).toHaveAttribute("href", "/settings");
    expect(toast.error).toHaveBeenCalled();
  });

  it("loads more messages with page token", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessages)
      .mockResolvedValueOnce({
        messages: [sampleMessage],
        nextPageToken: "page-2",
      })
      .mockResolvedValueOnce({
        messages: [
          {
            ...sampleMessage,
            id: "m2",
            subject: "Second page",
          },
        ],
        nextPageToken: null,
      });
    renderGmail();
    await waitFor(() => {
      expect(screen.getByText("Review please")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageToken: "page-2" }),
      );
    });
    expect(screen.getByText("Second page")).toBeInTheDocument();
  });

  it("stars a message from the list", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessages).mockResolvedValue({
      messages: [sampleMessage],
      nextPageToken: null,
    });
    vi.mocked(starGmailMessage).mockResolvedValue(undefined);
    renderGmail();
    await waitFor(() => {
      expect(screen.getByLabelText("Star message")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Star message"));

    expect(starGmailMessage).toHaveBeenCalledWith("m1", true);
    expect(toast.success).toHaveBeenCalledWith("Starred");
  });

  it("refreshes the list", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    renderGmail();
    await waitFor(() => expect(fetchGmailMessages).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(fetchGmailMessages).toHaveBeenCalledTimes(2);
    });
  });
});
