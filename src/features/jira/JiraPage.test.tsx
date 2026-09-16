import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getJiraSavedFilters,
  getJiraStatusTabOrder,
  saveJiraPublic,
  saveJiraSavedFilters,
  saveJiraStatusTabOrder,
  upsertJiraSavedFilter,
} from "@/lib/settings";

import {
  fetchJiraIssueTypes,
  fetchRemoteJiraFilters,
  saveFilterToJira,
  searchJiraIssues,
  suggestJiraLabels,
} from "./api";
import { JiraPage } from "./JiraPage";
import type { JiraIssue } from "./types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    fetchJiraIssueTypes: vi.fn().mockResolvedValue([]),
    fetchRemoteJiraFilters: vi
      .fn()
      .mockResolvedValue([
        { id: "670", name: "670", jql: "project = TTD", favourite: true },
      ]),
    searchJiraIssues: vi.fn().mockResolvedValue({
      issues: [],
      nextPageToken: null,
      isLast: true,
    }),
    suggestJiraLabels: vi.fn().mockResolvedValue([]),
    saveFilterToJira: vi.fn(),
  };
});

function renderJira() {
  return render(
    <MemoryRouter>
      <JiraPage />
    </MemoryRouter>,
  );
}

function connectJira() {
  saveJiraPublic({
    host: "https://borobudur.atlassian.net",
    email: "alice@example.com",
    displayName: "Ikhsan Mahendri",
    accountId: "acc",
    avatarUrl: "",
  });
}

function createDataTransfer(initial = "") {
  const store: Record<string, string> = { "text/plain": initial };
  return {
    effectAllowed: "",
    dropEffect: "",
    setData(type: string, value: string) {
      store[type] = value;
    },
    getData(type: string) {
      return store[type] ?? "";
    },
  };
}

function makeIssue(
  partial: Pick<JiraIssue, "id" | "key" | "summary" | "status"> &
    Partial<JiraIssue>,
): JiraIssue {
  return {
    type: { id: "2", name: "Story", iconUrl: "", subtask: false },
    parent: null,
    labels: [],
    assignee: { displayName: "Ikhsan", avatarUrl: "" },
    priority: null,
    updatedAt: "",
    browseUrl: "https://example.atlassian.net/browse/X",
    devStart: null,
    devEnd: null,
    storyPoints: null,
    ...partial,
  };
}

describe("JiraPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    saveJiraPublic(null);
    saveJiraSavedFilters([]);
    saveJiraStatusTabOrder([]);
    vi.mocked(fetchJiraIssueTypes).mockResolvedValue([]);
    vi.mocked(fetchRemoteJiraFilters).mockResolvedValue([
      { id: "670", name: "670", jql: "project = TTD", favourite: true },
    ]);
    vi.mocked(suggestJiraLabels).mockResolvedValue([]);
    vi.mocked(saveFilterToJira).mockResolvedValue("999");
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [],
      nextPageToken: null,
      isLast: true,
    });
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prompts to connect when Jira is not linked", () => {
    renderJira();
    expect(screen.getByRole("heading", { name: "Jira" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("puts saved and Jira filters in a dropdown with close and configure", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    upsertJiraSavedFilter({
      id: "jf_local",
      name: "My defects",
      jql: "assignee = currentUser()",
      typeIds: [],
      typeNames: [],
      labels: [],
      extraJql: "",
      includeDone: false,
      groupBy: "status",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderJira();

    await waitFor(() => {
      expect(screen.getByLabelText("Saved filter")).toBeInTheDocument();
    });
    expect(screen.queryByText("FROM JIRA")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Extra JQL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Clear filter")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Saved filter"));
    expect(
      await screen.findByRole("option", { name: "670" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "670" }));

    expect(screen.getByLabelText("Clear filter")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Clear filter"));
    expect(screen.queryByLabelText("Clear filter")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Configure filter" }));
    expect(screen.getByLabelText("Extra JQL")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close configuration" }),
    );
    expect(screen.queryByLabelText("Extra JQL")).not.toBeInTheDocument();
  });

  it("shows loading state while issues are fetched", async () => {
    let resolveSearch!: (value: {
      issues: JiraIssue[];
      nextPageToken: string | null;
      isLast: boolean;
    }) => void;
    vi.mocked(searchJiraIssues).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(await screen.findByText("Loading Jira issues…")).toBeInTheDocument();
    resolveSearch({ issues: [], nextPageToken: null, isLast: true });
    await waitFor(() => {
      expect(
        screen.queryByText("Loading Jira issues…"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows JQL error when search fails", async () => {
    vi.mocked(searchJiraIssues).mockRejectedValueOnce(new Error("Bad JQL"));
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(await screen.findByText(/Bad JQL/)).toBeInTheDocument();
  });

  it("loads more issues when another page is available", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues)
      .mockResolvedValueOnce({
        issues: [
          makeIssue({
            id: "1",
            key: "TTD-1",
            summary: "First page",
            status: { id: "10", name: "TODO", category: "new" },
          }),
        ],
        nextPageToken: "page-2",
        isLast: false,
      })
      .mockResolvedValueOnce({
        issues: [
          makeIssue({
            id: "2",
            key: "TTD-2",
            summary: "Second page",
            status: { id: "10", name: "TODO", category: "new" },
          }),
        ],
        nextPageToken: null,
        isLast: true,
      });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(await screen.findByText("First page")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second page")).toBeInTheDocument();
  });

  it("saves the current filter from configuration panel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    await screen.findByText("No issues match this filter.");

    await user.click(screen.getByRole("button", { name: "Configure filter" }));
    await user.type(screen.getByLabelText("Save filter as"), "My defects");
    await user.click(screen.getByRole("button", { name: "Save filter" }));

    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Saved “My defects”");
    expect(getJiraSavedFilters().some((f) => f.name === "My defects")).toBe(
      true,
    );
  });

  it("shows workflow tabs plus assignee and story points", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
          storyPoints: 5,
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Done item",
          status: { id: "20", name: "Dev Done", category: "done" },
          assignee: { displayName: "Alice", avatarUrl: "" },
          storyPoints: 2,
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(
      await screen.findByRole("tab", { name: /TODO/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dev Done/ })).toBeInTheDocument();
    expect(screen.getByText("Ikhsan")).toBeInTheDocument();
    expect(screen.getByText("5 SP")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Dev Done/ }));
    expect(screen.queryByText("Todo item")).not.toBeInTheDocument();
    expect(screen.getByText("Done item")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2 SP")).toBeInTheDocument();
  });

  it("loads remote Jira filters on connect", async () => {
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    await waitFor(() => expect(fetchRemoteJiraFilters).toHaveBeenCalled());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText("Saved filter"));
    expect(
      await screen.findByRole("option", { name: "670" }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no issues match the filter", async () => {
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(
      await screen.findByText("No issues match this filter."),
    ).toBeInTheDocument();
  });

  it("applies type, label, include-done, and extra JQL filters to search", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(fetchJiraIssueTypes).mockResolvedValue([
      {
        id: "1",
        name: "Story",
        iconUrl: "https://icon/story.png",
        subtask: false,
      },
    ]);
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    await waitFor(() => expect(searchJiraIssues).toHaveBeenCalled());
    vi.mocked(searchJiraIssues).mockClear();

    await user.click(screen.getByLabelText("Issue type"));
    await user.click(screen.getByRole("option", { name: "Story" }));
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(
        vi.mocked(searchJiraIssues).mock.calls[
          vi.mocked(searchJiraIssues).mock.calls.length - 1
        ]?.[0],
      ).toMatch(/type = "Story"/);
    });

    await user.type(screen.getByLabelText("Filter by label"), "ttd-fe-88");
    await user.keyboard("{Enter}");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(
        vi.mocked(searchJiraIssues).mock.calls[
          vi.mocked(searchJiraIssues).mock.calls.length - 1
        ]?.[0],
      ).toMatch(/ttd-fe-88/);
    });

    await user.click(screen.getByRole("button", { name: "Include done" }));
    vi.advanceTimersByTime(500);

    await user.type(screen.getByLabelText("Search or JQL"), "project = TTD");
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      const jql =
        vi.mocked(searchJiraIssues).mock.calls[
          vi.mocked(searchJiraIssues).mock.calls.length - 1
        ]?.[0] ?? "";
      expect(jql).toMatch(/project = TTD/);
    });
  });

  it("shows debounced label autocomplete hints and adds a hint on click", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(suggestJiraLabels).mockResolvedValue(["ttd-fe-88", "ttd-be-12"]);
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.type(screen.getByLabelText("Filter by label"), "ttd");
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(suggestJiraLabels).toHaveBeenCalledWith("ttd"));
    expect(
      await screen.findByRole("button", { name: "ttd-fe-88" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ttd-fe-88" }));
    vi.advanceTimersByTime(500);
    expect(
      screen.getByRole("button", { name: /ttd-fe-88 ×/ }),
    ).toBeInTheDocument();
  });

  it("removes a label chip when clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.type(screen.getByLabelText("Filter by label"), "release");
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: /release ×/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /release ×/ }));
    expect(
      screen.queryByRole("button", { name: /release ×/ }),
    ).not.toBeInTheDocument();
  });

  it("shows status group headers on All tab but hides them on a single status tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Done item",
          status: { id: "20", name: "Dev Done", category: "done" },
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(await screen.findByText("TODO (1)")).toBeInTheDocument();
    expect(screen.getByText("Dev Done (1)")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Dev Done/ }));
    expect(screen.queryByText("TODO (1)")).not.toBeInTheDocument();
    expect(screen.getByText("Done item")).toBeInTheDocument();
  });

  it("refreshes issues when Refresh is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    await waitFor(() => expect(searchJiraIssues).toHaveBeenCalled());
    const callsBefore = vi.mocked(searchJiraIssues).mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(vi.mocked(searchJiraIssues).mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });

  it("filters visible issues by assignee name or unassigned", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Mine",
          status: { id: "10", name: "TODO", category: "new" },
          assignee: { displayName: "Ikhsan", avatarUrl: "" },
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Alice work",
          status: { id: "10", name: "TODO", category: "new" },
          assignee: { displayName: "Alice", avatarUrl: "" },
        }),
        makeIssue({
          id: "3",
          key: "TTD-3",
          summary: "Nobody",
          status: { id: "10", name: "TODO", category: "new" },
          assignee: null,
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    expect(await screen.findByText("Mine")).toBeInTheDocument();
    expect(screen.getByText("Alice work")).toBeInTheDocument();
    expect(screen.getByText("Nobody")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Filter by assignee"), "alice");
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    expect(screen.getByText("Alice work")).toBeInTheDocument();
    expect(screen.queryByText("Nobody")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Filter by assignee"));
    await user.type(screen.getByLabelText("Filter by assignee"), "unassigned");
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    expect(screen.queryByText("Alice work")).not.toBeInTheDocument();
    expect(screen.getByText("Nobody")).toBeInTheDocument();
  });

  it("applies a saved local filter from the dropdown", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    upsertJiraSavedFilter({
      id: "jf_local",
      name: "My defects",
      jql: 'labels = "ttd-fe-88"',
      typeIds: [],
      typeNames: [],
      labels: ["ttd-fe-88"],
      extraJql: "project = TTD",
      includeDone: true,
      groupBy: "status",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(screen.getByLabelText("Saved filter"));
    await user.click(screen.getByRole("option", { name: "My defects" }));

    expect(
      screen.getByRole("button", { name: /ttd-fe-88 ×/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search or JQL")).toHaveValue("project = TTD");
    expect(screen.getByRole("button", { name: "Include done" })).toHaveClass(
      "bg-primary",
    );
  });

  it("shows assignee warning in configure panel when extra JQL contains assignee", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.type(screen.getByLabelText("Search or JQL"), "assignee = bob");
    await user.click(screen.getByRole("button", { name: "Configure filter" }));
    expect(
      screen.getByText(/Your assignee clause is used as written/),
    ).toBeInTheDocument();
  });

  it("pushes an active saved filter to Jira and can delete it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    upsertJiraSavedFilter({
      id: "jf_local",
      name: "Local view",
      jql: "assignee = currentUser()",
      typeIds: [],
      typeNames: [],
      labels: [],
      extraJql: "",
      includeDone: false,
      groupBy: "status",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(screen.getByLabelText("Saved filter"));
    await user.click(screen.getByRole("option", { name: "Local view" }));
    await user.click(screen.getByRole("button", { name: "Configure filter" }));

    await user.click(screen.getByRole("button", { name: /Save to Jira/ }));
    await waitFor(() => expect(saveFilterToJira).toHaveBeenCalled());
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Saved “Local view” to Jira",
    );

    await user.click(screen.getByRole("button", { name: "Delete Local view" }));
    expect(getJiraSavedFilters()).toHaveLength(0);
    expect(screen.queryByLabelText("Clear filter")).not.toBeInTheDocument();
  });

  it("reorders status tabs via drag and drop", async () => {
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Done item",
          status: { id: "20", name: "Dev Done", category: "done" },
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    const todoTab = await screen.findByRole("tab", { name: /TODO/ });
    const doneTab = screen.getByRole("tab", { name: /Dev Done/ });
    const dataTransfer = createDataTransfer("TODO");

    fireEvent.dragStart(todoTab, { dataTransfer });
    fireEvent.dragOver(doneTab, { dataTransfer });
    fireEvent.drop(doneTab, { dataTransfer });

    expect(getJiraStatusTabOrder()).toEqual(["Dev Done", "TODO"]);
  });

  it("shows errors when saving a filter without a name or with a duplicate name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(screen.getByRole("button", { name: "Configure filter" }));
    await user.click(screen.getByRole("button", { name: "Save filter" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Name the filter first",
    );

    await user.type(screen.getByLabelText("Save filter as"), "My defects");
    await user.click(screen.getByRole("button", { name: "Save filter" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Saved “My defects”");

    await user.type(screen.getByLabelText("Save filter as"), "my defects");
    await user.click(screen.getByRole("button", { name: "Save filter" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "A local filter already uses that name",
    );
  });

  it("resets status tab to All when assignee filter removes the selected tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
          assignee: { displayName: "Ikhsan", avatarUrl: "" },
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Done item",
          status: { id: "20", name: "Dev Done", category: "done" },
          assignee: { displayName: "Alice", avatarUrl: "" },
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(await screen.findByRole("tab", { name: /Dev Done/ }));
    expect(screen.getByText("Done item")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Filter by assignee"), "ikhsan");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^All/ })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
    expect(screen.getByText("Todo item")).toBeInTheDocument();
  });

  it("toasts when issue types fail to load and hides remote filters on fetch error", async () => {
    vi.mocked(fetchJiraIssueTypes).mockRejectedValueOnce(
      new Error("types fail"),
    );
    vi.mocked(fetchRemoteJiraFilters).mockRejectedValueOnce(
      new Error("remote fail"),
    );
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: types fail"),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByLabelText("Saved filter"));
    expect(
      screen.queryByRole("option", { name: "670" }),
    ).not.toBeInTheDocument();
  });

  it("toasts when pushing a saved filter to Jira fails", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    upsertJiraSavedFilter({
      id: "jf_local",
      name: "Local view",
      jql: "assignee = currentUser()",
      typeIds: [],
      typeNames: [],
      labels: [],
      extraJql: "",
      includeDone: false,
      groupBy: "status",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(saveFilterToJira).mockRejectedValueOnce(new Error("push fail"));
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(screen.getByLabelText("Saved filter"));
    await user.click(screen.getByRole("option", { name: "Local view" }));
    await user.click(screen.getByRole("button", { name: "Configure filter" }));
    await user.click(screen.getByRole("button", { name: /Save to Jira/ }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: push fail"),
    );
  });

  it("switches back to the All workflow tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        makeIssue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
        }),
        makeIssue({
          id: "2",
          key: "TTD-2",
          summary: "Done item",
          status: { id: "20", name: "Dev Done", category: "done" },
        }),
      ],
      nextPageToken: null,
      isLast: true,
    });
    connectJira();
    renderJira();
    vi.advanceTimersByTime(500);

    await user.click(await screen.findByRole("tab", { name: /Dev Done/ }));
    expect(screen.queryByText("Todo item")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^All/ }));
    expect(screen.getByText("Todo item")).toBeInTheDocument();
    expect(screen.getByText("Done item")).toBeInTheDocument();
  });
});
