import { describe, expect, it } from "vitest";

import {
  compileJql,
  extraJqlHasAssignee,
  quoteJql,
  sanitizeJql,
  sortIssueTypeNames,
  uniqueIssueTypes,
} from "./jql";

describe("compileJql", () => {
  it("builds my work default", () => {
    expect(
      compileJql({
        typeNames: [],
        labels: [],
        extraJql: "",
        includeDone: false,
      }),
    ).toBe(
      "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
    );
  });

  it("adds type, labels, extra JQL", () => {
    const jql = compileJql({
      typeNames: ["Story", "Bug"],
      labels: ["fe"],
      extraJql: "project = TIX",
      includeDone: true,
    });
    expect(jql).toContain('type IN ("Story", "Bug")');
    expect(jql).toContain('labels = "fe"');
    expect(jql).toContain("(project = TIX)");
    expect(jql).not.toContain("resolution = Unresolved");
  });

  it("detects assignee in extra JQL", () => {
    expect(extraJqlHasAssignee("assignee = bob")).toBe(true);
    expect(extraJqlHasAssignee("project = X")).toBe(false);
  });

  it("runs a pasted full JQL without wrapping currentUser or a second ORDER BY", () => {
    const extra = `assignee IN (currentUser(), 625547ba6b000700696f3f4c, 5d63678b9e2adc0c127269af)
AND labels = ttd-fe-88
ORDER BY created DESC`;
    const jql = compileJql({
      typeNames: [],
      labels: [],
      extraJql: extra,
      includeDone: false,
    });
    expect(jql).toContain(
      "assignee IN (currentUser(), 625547ba6b000700696f3f4c, 5d63678b9e2adc0c127269af)",
    );
    expect(jql).toContain('labels = "ttd-fe-88"');
    expect(jql).toContain("ORDER BY created DESC");
    expect(jql).not.toContain("assignee = currentUser()");
    expect(jql).not.toMatch(/ORDER BY created DESC\s+ORDER BY/i);
    expect(jql).not.toContain("resolution = Unresolved");
  });

  it("does not AND currentUser when extra already sets assignee", () => {
    const jql = compileJql({
      typeNames: [],
      labels: [],
      extraJql:
        "assignee IN (currentUser(), 625547ba6b000700696f3f4c) AND labels = ttd-fe-88",
      includeDone: true,
    });
    expect(jql).toContain('labels = "ttd-fe-88"');
    expect(jql).not.toContain("assignee = currentUser()");
    expect(jql.endsWith("ORDER BY updated DESC")).toBe(true);
  });

  it("quotes hyphenated label tokens", () => {
    expect(sanitizeJql("labels = ttd-fe-88")).toBe('labels = "ttd-fe-88"');
    expect(sanitizeJql('labels = "ttd-fe-88"')).toBe('labels = "ttd-fe-88"');
  });

  it("quotes quotes", () => {
    expect(quoteJql('a"b')).toBe('"a\\"b"');
  });

  it("pins common issue types", () => {
    const names = sortIssueTypeNames([
      { name: "Spike" },
      { name: "Bug" },
      { name: "Story" },
    ]).map((t) => t.name);
    expect(names[0]).toBe("Story");
    expect(names[1]).toBe("Bug");
  });

  it("keeps one row per issue type name", () => {
    expect(
      uniqueIssueTypes([
        { name: "Story", id: "1" },
        { name: "Story", id: "2" },
        { name: "Task", id: "3" },
        { name: "Defect", id: "4" },
        { name: "story", id: "5" },
      ]).map((t) => t.name),
    ).toEqual(["Story", "Task", "Defect"]);
  });
});
