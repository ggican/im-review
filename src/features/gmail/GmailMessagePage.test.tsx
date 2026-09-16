import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import {
  archiveGmailMessage,
  fetchGmailMessage,
  markGmailRead,
  starGmailMessage,
} from "./api";
import { GmailMessagePage } from "./GmailMessagePage";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchGmailMessage: vi.fn(),
    markGmailRead: vi.fn(),
    starGmailMessage: vi.fn(),
    archiveGmailMessage: vi.fn(),
  };
});

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const sampleMessage = {
  id: "msg-1",
  threadId: "t1",
  subject: "Deploy failed",
  from: "CI <ci@example.com>",
  to: "alice@example.com",
  cc: "",
  snippet: "Build failed",
  date: "2026-01-01T00:00:00.000Z",
  dateMs: Date.parse("2026-01-01T00:00:00.000Z"),
  labelIds: ["UNREAD", "INBOX"],
  unread: true,
  starred: false,
  bodyText: "Pipeline #42 failed.",
  bodyHtml: null,
  permalink: "https://mail.google.com/mail/#inbox/msg-1",
};

function renderMessage(messageId = "msg-1") {
  return render(
    <MemoryRouter initialEntries={[`/gmail/${messageId}`]}>
      <Routes>
        <Route path="/gmail/:messageId" element={<GmailMessagePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GmailMessagePage", () => {
  beforeEach(() => {
    saveGooglePublic(null);
    vi.mocked(fetchGmailMessage).mockReset();
    vi.mocked(markGmailRead).mockReset();
    vi.mocked(starGmailMessage).mockReset();
    vi.mocked(archiveGmailMessage).mockReset();
    vi.mocked(openUrl).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("prompts to connect when Google is not linked", () => {
    renderMessage();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("shows message body and actions when connected", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    renderMessage();
    await waitFor(() => {
      expect(screen.getByText("Pipeline #42 failed.")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Mark read" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open in Gmail" }),
    ).toBeInTheDocument();
  });

  it("marks message as read", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    vi.mocked(markGmailRead).mockResolvedValue(undefined);
    renderMessage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark read" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark read" }));

    expect(markGmailRead).toHaveBeenCalledWith("msg-1", true);
    expect(toast.success).toHaveBeenCalledWith("Marked as read");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark unread" }),
      ).toBeInTheDocument();
    });
  });

  it("marks message as unread", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
      ...sampleMessage,
      unread: false,
      labelIds: ["INBOX"],
    });
    vi.mocked(markGmailRead).mockResolvedValue(undefined);
    renderMessage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark unread" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark unread" }));

    expect(markGmailRead).toHaveBeenCalledWith("msg-1", false);
    expect(toast.success).toHaveBeenCalledWith("Marked as unread");
  });

  it("toggles star", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    vi.mocked(starGmailMessage).mockResolvedValue(undefined);
    renderMessage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Star" }));

    expect(starGmailMessage).toHaveBeenCalledWith("msg-1", true);
    expect(toast.success).toHaveBeenCalledWith("Starred");
  });

  it("archives message", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    vi.mocked(archiveGmailMessage).mockResolvedValue(undefined);
    renderMessage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Archive" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveGmailMessage).toHaveBeenCalledWith("msg-1");
    expect(toast.success).toHaveBeenCalledWith("Archived");
  });

  it("shows error when fetch fails", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockRejectedValue(
      new Error("403 insufficient permissions"),
    );
    renderMessage();
    expect(
      await screen.findByText(/Gmail access not granted/),
    ).toBeInTheDocument();
  });

  it("shows toast when action fails", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    vi.mocked(markGmailRead).mockRejectedValue(new Error("network"));
    renderMessage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Mark read" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark read" }));

    expect(toast.error).toHaveBeenCalled();
  });

  it("opens message in Gmail", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    renderMessage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open in Gmail" }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: "Open in Gmail" }));

    expect(openUrl).toHaveBeenCalledWith(sampleMessage.permalink);
  });

  it("renders html body when plain text is missing", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
      ...sampleMessage,
      bodyText: null,
      bodyHtml: "<p>HTML body</p>",
    });
    renderMessage();
    expect(await screen.findByText("HTML body")).toBeInTheDocument();
  });

  it("shows not found when fetch resolves without a message", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(
      null as unknown as typeof sampleMessage,
    );
    renderMessage();
    expect(await screen.findByText("Message not found.")).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockImplementation(
      () => new Promise(() => {}),
    );
    renderMessage();
    expect(screen.getByText("Loading message…")).toBeInTheDocument();
  });

  it("unstars message and shows read/starred badges", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
      ...sampleMessage,
      unread: false,
      starred: true,
      labelIds: ["INBOX", "STARRED"],
    });
    vi.mocked(starGmailMessage).mockResolvedValue(undefined);
    renderMessage();
    await waitFor(() => {
      expect(screen.getByText("Read")).toBeInTheDocument();
      expect(screen.getByText("Starred")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Unstar" }));
    expect(starGmailMessage).toHaveBeenCalledWith("msg-1", false);
    expect(toast.success).toHaveBeenCalledWith("Unstarred");
  });

  it("shows cc field and label badges", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
      ...sampleMessage,
      cc: "team@example.com",
      labelIds: ["INBOX", "IMPORTANT"],
    });
    renderMessage();
    expect(await screen.findByText("team@example.com")).toBeInTheDocument();
    expect(screen.getByText("IMPORTANT")).toBeInTheDocument();
  });

  it("opens inline Gmail link when body is empty", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
      ...sampleMessage,
      bodyText: null,
      bodyHtml: null,
    });
    renderMessage();
    const emptyBody = await screen.findByText(/No plain-text body/);
    await user.click(
      within(emptyBody).getByRole("button", { name: "Open in Gmail" }),
    );
    expect(openUrl).toHaveBeenCalledWith(sampleMessage.permalink);
  });

  it("surfaces star/archive/open failures", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue(sampleMessage);
    vi.mocked(starGmailMessage).mockRejectedValue(new Error("star fail"));
    vi.mocked(archiveGmailMessage).mockRejectedValue(new Error("archive fail"));
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("open fail"));
    renderMessage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Star" }));
    expect(toast.error).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(toast.error).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Open in Gmail" }));
    expect(toast.error).toHaveBeenCalledWith("Error: open fail");
  });
});
