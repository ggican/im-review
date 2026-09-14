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

  it("lists non-empty properties with names", () => {
    const props = listJiraProperties(
      { summary: "Title", customfield_10301: "2026-01-02", empty: null },
      { summary: "Summary", customfield_10301: "Dev Start Date" },
    );
    expect(props.map((p) => p.name)).toEqual(["Dev Start Date", "Summary"]);
    expect(props[0]?.text).toBe("2026-01-02");
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
    expect(parseStoryPoints(5)).toBe(5);
    expect(parseStoryPoints("3.5")).toBe(3.5);
    expect(parseStoryPoints(null)).toBeNull();
  });
});
