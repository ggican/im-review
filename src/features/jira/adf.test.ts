import { describe, expect, it } from "vitest";

import { adfToText } from "./adf";

describe("adfToText", () => {
  it("flattens paragraphs", () => {
    const text = adfToText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "World" }],
        },
      ],
    });
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });

  it("handles strings and empty", () => {
    expect(adfToText("plain")).toBe("plain");
    expect(adfToText(null)).toBe("");
    expect(adfToText(undefined)).toBe("");
    expect(adfToText(42)).toBe("");
  });

  it("flattens headings, lists, breaks, and blockquotes", () => {
    const text = adfToText({
      type: "doc",
      content: [
        {
          type: "heading",
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "blockquote",
          content: [{ type: "text", text: "Quoted" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "text", text: "Item one" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
        { type: "rule" },
      ],
    });
    expect(text).toContain("Title");
    expect(text).toContain("Quoted");
    expect(text).toContain("- Item one");
    expect(text).toContain("Line one");
    expect(text).toContain("Line two");
  });
});
