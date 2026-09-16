import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  gmailListMessages: vi.fn(),
  gmailGetMessage: vi.fn(),
  gmailModifyMessage: vi.fn(),
  gmailListLabels: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: mockApi,
}));

import { api } from "@/lib/api";

import {
  archiveGmailMessage,
  buildGmailQuery,
  fetchGmailLabels,
  fetchGmailMessage,
  fetchGmailMessages,
  gmailErrorMessage,
  gmailPermalink,
  mapGmailLabel,
  mapGmailMessage,
  markGmailRead,
  needsGmailReconnect,
  sanitizeHtml,
  starGmailMessage,
  tabToQuery,
} from "./api";
import type { GmailTab } from "./types";

describe("tabToQuery", () => {
  it("maps tabs to Gmail search queries", () => {
    expect(tabToQuery("inbox")).toBe("label:inbox");
    expect(tabToQuery("unread")).toBe("label:inbox is:unread");
    expect(tabToQuery("starred")).toBe("is:starred");
    expect(tabToQuery("sent")).toBe("label:sent");
  });

  it("falls back to inbox for unknown tabs", () => {
    expect(tabToQuery("unknown" as GmailTab)).toBe("label:inbox");
  });
});

describe("buildGmailQuery", () => {
  it("combines tab query with user search", () => {
    expect(buildGmailQuery("unread", "from:alice@example.com")).toBe(
      "label:inbox is:unread from:alice@example.com",
    );
    expect(buildGmailQuery("inbox", "  ")).toBe("label:inbox");
  });
});

describe("mapGmailLabel", () => {
  it("maps label records", () => {
    expect(
      mapGmailLabel({ id: "INBOX", name: "INBOX", type: "system" }),
    ).toEqual({ id: "INBOX", name: "INBOX", type: "system" });
    expect(
      mapGmailLabel({ id: "Label_1", name: "Work", type: "user" }),
    ).toEqual({ id: "Label_1", name: "Work", type: "user" });
    expect(mapGmailLabel(null)).toBeNull();
    expect(mapGmailLabel({ name: "No id" })).toBeNull();
  });
});

describe("mapGmailMessage", () => {
  it("extracts headers and plain body", () => {
    const body = btoa("Hello team");
    const mapped = mapGmailMessage({
      id: "msg1",
      threadId: "thr1",
      snippet: "Hello team",
      labelIds: ["UNREAD", "INBOX"],
      internalDate: "1700000000000",
      payload: {
        headers: [
          { name: "From", value: "Alice <alice@example.com>" },
          { name: "Subject", value: "PR review" },
          { name: "To", value: "bob@example.com" },
          { name: "Date", value: "Mon, 1 Jan 2024 00:00:00 +0000" },
        ],
        mimeType: "text/plain",
        body: { data: body },
      },
    });
    expect(mapped?.from).toContain("Alice");
    expect(mapped?.subject).toBe("PR review");
    expect(mapped?.unread).toBe(true);
    expect(mapped?.bodyText).toBe("Hello team");
    expect(mapped?.permalink).toBe(gmailPermalink("msg1"));
  });
});

describe("sanitizeHtml", () => {
  it("strips script tags and inline handlers", () => {
    const html =
      '<p>Hi</p><script>alert(1)</script><img src=x onerror="alert(2)">';
    const clean = sanitizeHtml(html);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onerror");
  });
});

describe("fetchGmailMessages", () => {
  beforeEach(() => {
    vi.mocked(api.gmailListMessages).mockReset();
    vi.mocked(api.gmailGetMessage).mockReset();
  });

  it("hydrates message summaries from list ids", async () => {
    vi.mocked(api.gmailListMessages).mockResolvedValue({
      messages: [{ id: "m1" }, { id: "m2" }],
      nextPageToken: "tok-2",
    });
    vi.mocked(api.gmailGetMessage).mockImplementation(async (id) => ({
      id,
      threadId: "t1",
      snippet: `Snippet ${id}`,
      labelIds: ["INBOX"],
      internalDate: "1700000000000",
      payload: {
        headers: [
          { name: "From", value: "Alice" },
          { name: "Subject", value: `Subject ${id}` },
          { name: "Date", value: "Mon, 1 Jan 2024 00:00:00 +0000" },
        ],
      },
    }));

    const page = await fetchGmailMessages({ tab: "inbox" });

    expect(api.gmailListMessages).toHaveBeenCalledWith({
      query: "label:inbox",
      labelIds: undefined,
      pageToken: null,
      maxResults: 25,
    });
    expect(page.messages).toHaveLength(2);
    expect(page.messages[0]?.subject).toBe("Subject m1");
    expect(page.nextPageToken).toBe("tok-2");
  });

  it("skips messages that fail to hydrate", async () => {
    vi.mocked(api.gmailListMessages).mockResolvedValue({
      messages: [{ id: "ok" }, { id: "bad" }],
    });
    vi.mocked(api.gmailGetMessage).mockImplementation(async (id) => {
      if (id === "bad") throw new Error("not found");
      return {
        id: "ok",
        threadId: "t1",
        snippet: "ok",
        labelIds: [],
        payload: { headers: [{ name: "Subject", value: "OK" }] },
      };
    });

    const page = await fetchGmailMessages({
      tab: "unread",
      search: "from:bob",
    });

    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]?.id).toBe("ok");
  });

  it("passes labelId and pageToken when provided", async () => {
    vi.mocked(api.gmailListMessages).mockResolvedValue({ messages: [] });
    await fetchGmailMessages({
      tab: "starred",
      labelId: " Label_1 ",
      pageToken: "page-2",
    });
    expect(api.gmailListMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "is:starred",
        labelIds: ["Label_1"],
        pageToken: "page-2",
      }),
    );
  });
});

describe("fetchGmailMessage", () => {
  beforeEach(() => {
    vi.mocked(api.gmailGetMessage).mockReset();
  });

  it("returns a mapped full message", async () => {
    vi.mocked(api.gmailGetMessage).mockResolvedValue({
      id: "full-1",
      threadId: "t1",
      snippet: "Hi",
      labelIds: ["INBOX"],
      payload: {
        headers: [{ name: "Subject", value: "Full" }],
        mimeType: "text/plain",
        body: { data: btoa("Body") },
      },
    });
    const msg = await fetchGmailMessage("full-1");
    expect(msg.id).toBe("full-1");
    expect(msg.bodyText).toBe("Body");
    expect(api.gmailGetMessage).toHaveBeenCalledWith("full-1", "full");
  });

  it("throws when the payload cannot be parsed", async () => {
    vi.mocked(api.gmailGetMessage).mockResolvedValue({ payload: {} });
    await expect(fetchGmailMessage("bad")).rejects.toThrow(
      "Could not parse Gmail message",
    );
  });
});

describe("fetchGmailLabels", () => {
  beforeEach(() => {
    vi.mocked(api.gmailListLabels).mockReset();
  });

  it("returns sorted labels", async () => {
    vi.mocked(api.gmailListLabels).mockResolvedValue({
      labels: [
        { id: "Z", name: "Zebra", type: "user" },
        { id: "INBOX", name: "INBOX", type: "system" },
        { id: "", name: "Skip me" },
      ],
    });
    const labels = await fetchGmailLabels();
    expect(labels.map((l) => l.name)).toEqual(["INBOX", "Zebra"]);
  });
});

describe("markGmailRead", () => {
  beforeEach(() => {
    vi.mocked(api.gmailModifyMessage).mockReset();
  });

  it("removes UNREAD when marking read", async () => {
    await markGmailRead("m1", true);
    expect(api.gmailModifyMessage).toHaveBeenCalledWith("m1", {
      addLabelIds: [],
      removeLabelIds: ["UNREAD"],
    });
  });

  it("adds UNREAD when marking unread", async () => {
    await markGmailRead("m1", false);
    expect(api.gmailModifyMessage).toHaveBeenCalledWith("m1", {
      addLabelIds: ["UNREAD"],
      removeLabelIds: [],
    });
  });
});

describe("starGmailMessage", () => {
  beforeEach(() => {
    vi.mocked(api.gmailModifyMessage).mockReset();
  });

  it("adds STARRED when starring", async () => {
    await starGmailMessage("m1", true);
    expect(api.gmailModifyMessage).toHaveBeenCalledWith("m1", {
      addLabelIds: ["STARRED"],
      removeLabelIds: [],
    });
  });

  it("removes STARRED when unstarring", async () => {
    await starGmailMessage("m1", false);
    expect(api.gmailModifyMessage).toHaveBeenCalledWith("m1", {
      addLabelIds: [],
      removeLabelIds: ["STARRED"],
    });
  });
});

describe("archiveGmailMessage", () => {
  beforeEach(() => {
    vi.mocked(api.gmailModifyMessage).mockReset();
  });

  it("removes INBOX label", async () => {
    await archiveGmailMessage("m1");
    expect(api.gmailModifyMessage).toHaveBeenCalledWith("m1", {
      removeLabelIds: ["INBOX"],
    });
  });
});

describe("gmailErrorMessage", () => {
  it("maps Gmail API disabled errors", () => {
    expect(
      gmailErrorMessage(new Error("403 Gmail API has not been used")),
    ).toContain("Gmail API is disabled");
  });

  it("maps insufficient scope errors", () => {
    expect(
      gmailErrorMessage(new Error("403 insufficient permissions")),
    ).toContain("Gmail access not granted");
  });

  it("strips google error prefixes", () => {
    expect(gmailErrorMessage(new Error("Google error 500: timeout"))).toBe(
      "timeout",
    );
    expect(gmailErrorMessage("")).toBe("Gmail request failed");
  });
});

describe("needsGmailReconnect", () => {
  it("detects reconnect-worthy errors", () => {
    expect(needsGmailReconnect(new Error("403 forbidden"))).toBe(true);
    expect(needsGmailReconnect(new Error("insufficient scope"))).toBe(true);
    expect(needsGmailReconnect(new Error("missing scope"))).toBe(true);
    expect(needsGmailReconnect(new Error("network error"))).toBe(false);
  });
});
