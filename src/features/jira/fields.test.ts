import { describe, expect, it } from "vitest";

import {
  formatJiraValue,
  isDevEndName,
  isDevStartName,
  listJiraProperties,
  matchDevDateFieldIds,
  matchStoryPointsFieldId,
  parseStoryPoints,
  pickNamedProperty,
} from "./fields";

describe("jira field formatting", () => {
  it("formats users, options, dates, and ADF", () => {
    expect(formatJiraValue({ displayName: "Ikhsan" })).toBe("Ikhsan");
    expect(formatJiraValue({ value: "High", id: "1" })).toBe("High");
    expect(formatJiraValue("2026-03-01")).toBe("2026-03-01");
    expect(formatJiraValue("2026-03-01T12:30:00.000Z")).toBe(
      "2026-03-01 12:30:00 UTC",
    );
    expect(formatJiraValue(42)).toBe("42");
    expect(formatJiraValue(true)).toBe("true");
    expect(
      formatJiraValue({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello" }],
          },
        ],
      }),
    ).toContain("Hello");
  });

  it("formats arrays and nested objects", () => {
    expect(
      formatJiraValue([{ displayName: "Alice" }, { displayName: "Bob" }]),
    ).toBe("Alice, Bob");
    expect(
      formatJiraValue({
        key: "TIX-1",
        fields: { summary: "Parent issue" },
      }),
    ).toBe("TIX-1 — Parent issue");
    expect(formatJiraValue({ filename: "spec.pdf" })).toBe("spec.pdf");
    expect(
      formatJiraValue({
        name: "In Progress",
        id: "3",
        statusCategory: { key: "indeterminate" },
      }),
    ).toBe("In Progress");
  });

  it("formats comments and timetracking", () => {
    expect(
      formatJiraValue({
        comments: [
          {
            author: { displayName: "Alice" },
            created: "2026-01-01T00:00:00.000Z",
            body: { type: "doc", content: [] },
          },
        ],
      }),
    ).toContain("Alice");
    expect(
      formatJiraValue({
        originalEstimate: "1d",
        remainingEstimate: "4h",
        timeSpent: "2h",
      }),
    ).toBe("original 1d · remaining 4h · spent 2h");
  });

  it("respects depth limit and skips empty values", () => {
    expect(formatJiraValue(null)).toBe("");
    expect(formatJiraValue("")).toBe("");
    expect(formatJiraValue(undefined)).toBe("");
    expect(formatJiraValue(Symbol("x") as unknown)).toBe("");
    expect(formatJiraValue({ self: "x", nested: { a: "b" } })).toContain(
      "nested: a: b",
    );
  });

  it("lists non-empty properties with names", () => {
    const props = listJiraProperties(
      { summary: "Title", customfield_10301: "2026-01-02", empty: null },
      { summary: "Summary", customfield_10301: "Dev Start Date" },
    );
    expect(props.map((p) => p.name)).toEqual(["Dev Start Date", "Summary"]);
    expect(props[0]?.text).toBe("2026-01-02");
  });

  it("humanizes built-in field ids without names", () => {
    const props = listJiraProperties({ fixVersions: [{ name: "v1" }] }, {});
    expect(props[0]?.name).toBe("Fix Versions");
    expect(props[0]?.text).toBe("name: v1");
  });

  it("keeps customfield ids as-is", () => {
    const props = listJiraProperties({ customfield_99999: "value" }, {});
    expect(props[0]?.name).toBe("customfield_99999");
  });

  it("matches Dev Start / Dev End field ids", () => {
    const ids = matchDevDateFieldIds([
      { id: "customfield_10301", name: "Dev Start Date" },
      { id: "customfield_10302", name: "Dev End Date" },
      { id: "customfield_11471", name: "DevOps End Date" },
    ]);
    expect(ids.start).toBe("customfield_10301");
    expect(ids.end).toBe("customfield_10302");
    expect(isDevStartName("Dev Start Date")).toBe(true);
    expect(isDevEndName("Dev End Date")).toBe(true);
  });

  it("picks named date fields even when empty", () => {
    const start = pickNamedProperty(
      { customfield_10301: null },
      { customfield_10301: "Dev Start Date" },
      isDevStartName,
    );
    expect(start?.name).toBe("Dev Start Date");
    expect(start?.text).toBe("");
  });

  it("matches story points field and parses values", () => {
    expect(
      matchStoryPointsFieldId([
        { id: "customfield_10016", name: "Story Points" },
        { id: "customfield_1", name: "Summary" },
      ]),
    ).toBe("customfield_10016");
    expect(
      matchStoryPointsFieldId([
        { id: "customfield_200", name: "Story point estimate" },
      ]),
    ).toBe("customfield_200");
    expect(parseStoryPoints(5)).toBe(5);
    expect(parseStoryPoints("3.5")).toBe(3.5);
    expect(parseStoryPoints({ value: "8" })).toBe(8);
    expect(parseStoryPoints({ value: "nope" })).toBeNull();
    expect(parseStoryPoints("")).toBeNull();
    expect(parseStoryPoints(null)).toBeNull();
  });
});
