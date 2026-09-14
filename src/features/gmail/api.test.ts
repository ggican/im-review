import { describe, expect, it } from "vitest";

import {
  buildGmailQuery,
  gmailPermalink,
  mapGmailLabel,
  mapGmailMessage,
  sanitizeHtml,
  tabToQuery,
} from "./api";

describe("tabToQuery", () => {
  it("maps tabs to Gmail search queries", () => {
    expect(tabToQuery("inbox")).toBe("label:inbox");
    expect(tabToQuery("unread")).toBe("label:inbox is:unread");
    expect(tabToQuery("starred")).toBe("is:starred");
    expect(tabToQuery("sent")).toBe("label:sent");
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
    expect(mapGmailLabel({ id: "Label_1", name: "Work", type: "user" })).toEqual(
      { id: "Label_1", name: "Work", type: "user" },
    );
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
