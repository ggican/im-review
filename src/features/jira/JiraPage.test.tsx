import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  saveJiraPublic,
  saveJiraSavedFilters,
  upsertJiraSavedFilter,
} from "@/lib/settings";

import { searchJiraIssues } from "./api";
import { JiraPage } from "./JiraPage";
import type { JiraIssue } from "./types";

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

describe("JiraPage", () => {
  beforeEach(() => {
    saveJiraPublic(null);
    saveJiraSavedFilters([]);
  });

  it("prompts to connect when Jira is not linked", () => {
    renderJira();
    expect(screen.getByRole("heading", { name: "Jira" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("puts saved and Jira filters in a dropdown with close and configure", async () => {
    const user = userEvent.setup();
    saveJiraPublic({
      host: "https://borobudur.atlassian.net",
      email: "alice@example.com",
      displayName: "Ikhsan Mahendri",
      accountId: "acc",
      avatarUrl: "",
    });
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

  it("shows workflow tabs plus assignee and story points", async () => {
    const user = userEvent.setup();
    const issue = (
      partial: Pick<JiraIssue, "id" | "key" | "summary" | "status"> &
        Partial<JiraIssue>,
    ): JiraIssue => ({
      type: { id: "2", name: "Story", iconUrl: "", subtask: false },
      parent: null,
      labels: [],
      assignee: { displayName: "Ikhsan", avatarUrl: "" },
      priority: null,
      updatedAt: "",
      browseUrl: "https://example.atlassian.net/browse/X",
      devStart: null,
      devEnd: null,
      storyPoints: 5,
      ...partial,
    });
    vi.mocked(searchJiraIssues).mockResolvedValue({
      issues: [
        issue({
          id: "1",
          key: "TTD-1",
          summary: "Todo item",
          status: { id: "10", name: "TODO", category: "new" },
        }),
        issue({
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
    saveJiraPublic({
      host: "https://borobudur.atlassian.net",
      email: "alice@example.com",
      displayName: "Ikhsan Mahendri",
      accountId: "acc",
      avatarUrl: "",
    });
    renderJira();
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
});
