import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGooglePublic } from "@/lib/settings";

import { fetchGmailMessage } from "./api";
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

function renderMessage() {
  return render(
    <MemoryRouter initialEntries={["/gmail/msg-1"]}>
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
  });

  it("prompts to connect when Google is not linked", () => {
    renderMessage();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("shows message body and actions when connected", async () => {
    saveGooglePublic({ email: "alice@example.com", name: "Alice" });
    vi.mocked(fetchGmailMessage).mockResolvedValue({
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
    });
    renderMessage();
    await waitFor(() => {
      expect(screen.getByText("Pipeline #42 failed.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in Gmail" })).toBeInTheDocument();
  });
});
