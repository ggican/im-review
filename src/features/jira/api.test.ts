import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  jiraRequest: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: mockApi,
}));

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>();
  return {
    ...actual,
    getJiraPublic: vi.fn(),
  };
});

import { api } from "@/lib/api";
import { getJiraPublic } from "@/lib/settings";

import {
  fetchJiraIssueDetail,
  fetchJiraIssueTypes,
  fetchJiraTransitions,
  fetchRemoteJiraFilters,
  groupIssuesByStatus,
  jiraErrorMessage,
  mapJiraIssue,
  saveFilterToJira,
  searchJiraIssues,
  searchJiraIssuesAll,
  suggestJiraLabels,
  transitionJiraIssue,
} from "./api";

const fieldCatalog = [
  { id: "customfield_10301", name: "Dev Start Date" },
  { id: "customfield_10302", name: "Dev End Date" },
  { id: "customfield_10016", name: "Story Points" },
];

function mockFieldCatalog() {
  vi.mocked(api.jiraRequest).mockImplementation(async (method, path) => {
    if (method === "GET" && path === "/rest/api/3/field") {
      return fieldCatalog;
    }
    return {};
  });
}

describe("jira mappers", () => {
  beforeEach(() => {
    vi.mocked(getJiraPublic).mockReturnValue({
      host: "https://jira.example.com",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
  });

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
    expect(issue.browseUrl).toBe("https://jira.example.com/browse/TIX-2");
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

  it("maps assignee avatar and priority", () => {
    const issue = mapJiraIssue({
      key: "TIX-3",
      fields: {
        summary: "Task",
        status: {
          name: "Done",
          statusCategory: { key: "done", colorName: "green" },
        },
        issuetype: { name: "Bug" },
        assignee: {
          displayName: "Bob",
          avatarUrls: { "48x48": "https://avatar/48" },
        },
        priority: { name: "High" },
      },
    });
    expect(issue.assignee?.avatarUrl).toBe("https://avatar/48");
    expect(issue.priority).toBe("High");
    expect(issue.status.category).toBe("done");
  });

  it("handles missing parent key and unknown status category", () => {
    const issue = mapJiraIssue({
      key: "TIX-4",
      fields: {
        summary: "Solo",
        status: { name: "Mystery", statusCategory: { key: "weird" } },
        issuetype: { name: "Story" },
        parent: { fields: { summary: "No key" } },
      },
    });
    expect(issue.parent).toBeNull();
    expect(issue.status.category).toBe("unknown");
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

describe("searchJiraIssues", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
    mockFieldCatalog();
  });

  it("searches issues with resolved extra fields", async () => {
    vi.mocked(api.jiraRequest).mockImplementation(async (method, path) => {
      if (method === "GET" && path === "/rest/api/3/field") return fieldCatalog;
      if (method === "POST" && path === "/rest/api/3/search/jql") {
        return {
          issues: [
            {
              id: "1",
              key: "TIX-1",
              fields: {
                summary: "One",
                status: { name: "Open", statusCategory: { key: "new" } },
                issuetype: { name: "Story" },
                customfield_10016: 3,
              },
            },
          ],
          nextPageToken: "tok-2",
          isLast: false,
        };
      }
      return {};
    });

    const page = await searchJiraIssues("project = TIX");

    expect(page.issues).toHaveLength(1);
    expect(page.issues[0]?.storyPoints).toBe(3);
    expect(page.nextPageToken).toBe("tok-2");
    expect(page.isLast).toBe(false);
  });

  it("passes nextPageToken when paginating", async () => {
    vi.mocked(api.jiraRequest).mockImplementation(
      async (method, path, body) => {
        if (method === "GET" && path === "/rest/api/3/field")
          return fieldCatalog;
        if (method === "POST" && path === "/rest/api/3/search/jql") {
          expect(body).toEqual(
            expect.objectContaining({ nextPageToken: "tok-2" }),
          );
          return { issues: [], isLast: true };
        }
        return {};
      },
    );

    await searchJiraIssues("project = TIX", "tok-2");
  });
});

describe("searchJiraIssuesAll", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
    mockFieldCatalog();
  });

  it("paginates until isLast", async () => {
    let calls = 0;
    vi.mocked(api.jiraRequest).mockImplementation(async (method, path) => {
      if (method === "GET" && path === "/rest/api/3/field") return fieldCatalog;
      if (method === "POST" && path === "/rest/api/3/search/jql") {
        calls += 1;
        if (calls === 1) {
          return {
            issues: [
              {
                key: "A",
                fields: {
                  summary: "A",
                  status: { name: "Open" },
                  issuetype: { name: "Story" },
                },
              },
            ],
            nextPageToken: "p2",
            isLast: false,
          };
        }
        return {
          issues: [
            {
              key: "B",
              fields: {
                summary: "B",
                status: { name: "Open" },
                issuetype: { name: "Story" },
              },
            },
          ],
          isLast: true,
        };
      }
      return {};
    });

    const all = await searchJiraIssuesAll("project = TIX");
    expect(all.map((i) => i.key)).toEqual(["A", "B"]);
  });
});

describe("fetchJiraIssueTypes", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("returns sorted unique issue types", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue([
      { id: "2", name: "Story", iconUrl: "", subtask: false },
      { id: "1", name: "Bug", iconUrl: "", subtask: false },
      { id: "2", name: "Story", iconUrl: "", subtask: false },
    ]);
    const types = await fetchJiraIssueTypes();
    expect(types.map((t) => t.name)).toEqual(["Story", "Bug"]);
  });
});

describe("suggestJiraLabels", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("lists labels when query is empty", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({ values: ["fe", "be"] });
    await expect(suggestJiraLabels("  ")).resolves.toEqual(["fe", "be"]);
    expect(api.jiraRequest).toHaveBeenCalledWith(
      "GET",
      "/rest/api/3/label?maxResults=50",
    );
  });

  it("autocompletes labels for a query", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({
      results: [{ value: "frontend" }, { value: "" }],
    });
    await expect(suggestJiraLabels("front")).resolves.toEqual(["frontend"]);
    expect(api.jiraRequest).toHaveBeenCalledWith(
      "GET",
      "/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=front",
    );
  });
});

describe("fetchJiraIssueDetail", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("returns expanded issue detail", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({
      key: "TIX-10",
      fields: {
        summary: "Detail",
        status: { name: "Open", statusCategory: { key: "new" } },
        issuetype: { name: "Story" },
        project: { key: "TIX" },
        subtasks: [{ key: "TIX-11" }],
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Notes" }] },
          ],
        },
        customfield_10301: "2026-01-01",
      },
      names: {
        summary: "Summary",
        customfield_10301: "Dev Start Date",
        customfield_10302: "Dev End Date",
      },
    });

    const detail = await fetchJiraIssueDetail("TIX-10");
    expect(detail.projectKey).toBe("TIX");
    expect(detail.subtaskKeys).toEqual(["TIX-11"]);
    expect(detail.descriptionText).toBe("Notes");
    expect(detail.devStartField?.name).toBe("Dev Start Date");
  });
});

describe("fetchJiraTransitions", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("maps available transitions", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({
      transitions: [
        { id: "21", name: "Start", to: { name: "In Progress" } },
        { id: "", name: "Skip me" },
      ],
    });
    await expect(fetchJiraTransitions("TIX-1")).resolves.toEqual([
      { id: "21", name: "Start", toName: "In Progress" },
    ]);
  });
});

describe("transitionJiraIssue", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("posts transition payload", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue(undefined);
    await transitionJiraIssue("TIX-1", "21");
    expect(api.jiraRequest).toHaveBeenCalledWith(
      "POST",
      "/rest/api/3/issue/TIX-1/transitions",
      { transition: { id: "21" } },
    );
  });
});

describe("fetchRemoteJiraFilters", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("merges my and favourite filters without duplicates", async () => {
    vi.mocked(api.jiraRequest).mockImplementation(async (_method, path) => {
      if (path === "/rest/api/3/filter/my") {
        return [
          { id: "1", name: "Beta", jql: "project = B", favourite: false },
          { id: "2", name: "Alpha", jql: "project = A", favourite: true },
        ];
      }
      if (path === "/rest/api/3/filter/favourite") {
        return [
          { id: "2", name: "Alpha", jql: "project = A", favourite: true },
        ];
      }
      return [];
    });

    const filters = await fetchRemoteJiraFilters();
    expect(filters.map((f) => f.name)).toEqual(["Alpha", "Beta"]);
  });

  it("tolerates failed favourite fetch", async () => {
    vi.mocked(api.jiraRequest).mockImplementation(async (_method, path) => {
      if (path === "/rest/api/3/filter/my") {
        return [
          { id: "1", name: "Mine", jql: "assignee = me", favourite: false },
        ];
      }
      throw new Error("fail");
    });

    const filters = await fetchRemoteJiraFilters();
    expect(filters).toHaveLength(1);
  });
});

describe("saveFilterToJira", () => {
  beforeEach(() => {
    vi.mocked(api.jiraRequest).mockReset();
  });

  it("creates a new filter", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({ id: "99" });
    await expect(
      saveFilterToJira({ name: "Mine", jql: "assignee = currentUser()" }),
    ).resolves.toBe("99");
    expect(api.jiraRequest).toHaveBeenCalledWith("POST", "/rest/api/3/filter", {
      name: "Mine",
      jql: "assignee = currentUser()",
      favourite: true,
    });
  });

  it("updates an existing filter", async () => {
    vi.mocked(api.jiraRequest).mockResolvedValue({ id: "42" });
    await expect(
      saveFilterToJira({
        name: "Updated",
        jql: "project = TIX",
        jiraFilterId: "42",
      }),
    ).resolves.toBe("42");
    expect(api.jiraRequest).toHaveBeenCalledWith(
      "PUT",
      "/rest/api/3/filter/42",
      { name: "Updated", jql: "project = TIX", favourite: true },
    );
  });
});

describe("jiraErrorMessage", () => {
  it("parses JSON error payloads", () => {
    expect(
      jiraErrorMessage(
        'Jira error 400: {"errorMessages":["Bad JQL"],"errors":{"jql":"Invalid"}}',
      ),
    ).toBe("Bad JQL Invalid");
  });

  it("strips jira error prefix and falls back", () => {
    expect(jiraErrorMessage("Jira error 500: timeout")).toBe("timeout");
    expect(jiraErrorMessage("")).toBe("Jira request failed");
  });

  it("falls through on invalid JSON", () => {
    expect(jiraErrorMessage('{"errorMessages":')).toBe('{"errorMessages":');
  });
});
