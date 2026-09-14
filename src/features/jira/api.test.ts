import { describe, expect, it } from "vitest";

import { groupIssuesByStatus, mapJiraIssue } from "./api";

describe("jira mappers", () => {
  it("maps issue + parent + subtask", () => {
    const issue = mapJiraIssue({
      id: "1",
      key: "TIX-2",
      fields: {
        summary: "Child",
        status: {
          id: "3",
          name: "In Progress",
          statusCategory: { key: "indeterminate" },
        },
        issuetype: { id: "5", name: "Sub-task", iconUrl: "", subtask: true },
        parent: {
          key: "TIX-1",
          fields: {
            summary: "Parent story",
            issuetype: { name: "Story", subtask: false },
          },
        },
        labels: ["fe"],
        assignee: { displayName: "Ikhsan" },
        updated: "2026-09-14T00:00:00.000Z",
      },
    });
    expect(issue.key).toBe("TIX-2");
    expect(issue.type.subtask).toBe(true);
    expect(issue.parent?.key).toBe("TIX-1");
    expect(issue.parent?.summary).toBe("Parent story");
    expect(issue.labels).toEqual(["fe"]);
    expect(issue.storyPoints).toBeNull();
  });

  it("maps story points from a custom field", () => {
    const issue = mapJiraIssue(
      {
        id: "1",
        key: "TIX-9",
        fields: {
          summary: "Sized",
          status: { name: "TODO", statusCategory: { key: "new" } },
          issuetype: { name: "Story" },
          customfield_10016: 5,
        },
      },
      { start: null, end: null, storyPoints: "customfield_10016" },
    );
    expect(issue.storyPoints).toBe(5);
  });

  it("groups by status category order", () => {
    const a = mapJiraIssue({
      id: "1",
      key: "A",
      fields: {
        summary: "a",
        status: { name: "To Do", statusCategory: { key: "new" } },
        issuetype: { name: "Story" },
      },
    });
    const b = mapJiraIssue({
      id: "2",
      key: "B",
      fields: {
        summary: "b",
        status: {
          name: "In Progress",
          statusCategory: { key: "indeterminate" },
        },
        issuetype: { name: "Story" },
      },
    });
    const groups = groupIssuesByStatus([a, b]);
    expect(groups[0]?.status).toBe("In Progress");
    expect(groups[1]?.status).toBe("To Do");
  });
});
