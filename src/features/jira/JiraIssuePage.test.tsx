import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveJiraPublic } from "@/lib/settings";

import { JiraIssuePage } from "./JiraIssuePage";
import type { JiraIssueDetail } from "./types";

const detail: JiraIssueDetail = {
  id: "1",
  key: "HS-165",
  summary: "Create Endpoint List of Preferred Vendor",
  status: { id: "1", name: "TODO", category: "new" },
  type: { id: "2", name: "Task", iconUrl: "", subtask: false },
  parent: null,
  labels: ["ttd-fe-88"],
  assignee: { displayName: "Ikhsan", avatarUrl: "" },
  priority: "Medium",
  updatedAt: "2026-09-14T00:00:00.000Z",
  browseUrl: "https://example.atlassian.net/browse/HS-165",
  devStart: "2026-01-02",
  devEnd: "2026-01-10",
  storyPoints: 3,
  descriptionText: "Build the list endpoint.",
  projectKey: "HS",
  subtaskKeys: [],
  properties: [
    {
      id: "summary",
      name: "Summary",
      text: "Create Endpoint List of Preferred Vendor",
    },
    { id: "customfield_10301", name: "Dev Start Date", text: "2026-01-02" },
    { id: "customfield_10302", name: "Dev End Date", text: "2026-01-10" },
  ],
  devStartField: {
    id: "customfield_10301",
    name: "Dev Start Date",
    text: "2026-01-02",
  },
  devEndField: {
    id: "customfield_10302",
    name: "Dev End Date",
    text: "2026-01-10",
  },
};

vi.mock("./api", () => ({
  fetchJiraIssueDetail: vi.fn(),
  fetchJiraTransitions: vi.fn(),
  transitionJiraIssue: vi.fn(),
  jiraErrorMessage: (err: unknown) => String(err),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

import {
  fetchJiraIssueDetail,
  fetchJiraTransitions,
  transitionJiraIssue,
} from "./api";

const mockDetail = vi.mocked(fetchJiraIssueDetail);
const mockTransitions = vi.mocked(fetchJiraTransitions);
const mockTransition = vi.mocked(transitionJiraIssue);

function renderIssue() {
  return render(
    <MemoryRouter initialEntries={["/jira/HS-165"]}>
      <Routes>
        <Route path="/jira/:issueKey" element={<JiraIssuePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JiraIssuePage", () => {
  beforeEach(() => {
    saveJiraPublic({
      host: "https://example.atlassian.net",
      email: "a@b.com",
      displayName: "Ikhsan",
      accountId: "acc",
      avatarUrl: "",
    });
    mockDetail.mockResolvedValue(detail);
    mockTransitions.mockResolvedValue([
      { id: "211", name: "To-Do", toName: "TODO" },
      { id: "91", name: "Done", toName: "Done." },
    ]);
    mockTransition.mockResolvedValue(undefined);
  });

  it("renders a full page with dates, all fields, and status update", async () => {
    const user = userEvent.setup();
    renderIssue();
    expect(
      await screen.findByRole("heading", { name: "HS-165" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Create Endpoint List of Preferred Vendor").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Dev Start Date").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-01-02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dev End Date").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-01-10").length).toBeGreaterThan(0);
    expect(screen.getByText("All Jira fields (3)")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("New status"));
    await user.click(screen.getByRole("option", { name: /Done/ }));
    await user.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => {
      expect(mockTransition).toHaveBeenCalledWith("HS-165", "91");
    });
  });
});
