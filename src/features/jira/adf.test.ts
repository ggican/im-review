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
  });
});
