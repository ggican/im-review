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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

import {
  fetchJiraIssueDetail,
  fetchJiraTransitions,
  transitionJiraIssue,
} from "./api";

const mockDetail = vi.mocked(fetchJiraIssueDetail);
const mockTransitions = vi.mocked(fetchJiraTransitions);
const mockTransition = vi.mocked(transitionJiraIssue);
const mockOpenUrl = vi.mocked(openUrl);

function renderIssue(initialEntry = "/jira/HS-165") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    mockOpenUrl.mockResolvedValue(undefined);
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("prompts to connect when Jira is not linked", () => {
    saveJiraPublic(null);
    renderIssue();
    expect(
      screen.getByRole("link", { name: /Connect in Settings/ }),
    ).toHaveAttribute("href", "/settings");
  });

  it("shows loading state while issue detail is fetched", async () => {
    let resolveDetail!: (value: JiraIssueDetail) => void;
    mockDetail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );
    renderIssue();
    expect(screen.getByText("Loading issue…")).toBeInTheDocument();
    resolveDetail(detail);
    expect(
      await screen.findByRole("heading", { name: "HS-165" }),
    ).toBeInTheDocument();
  });

  it("shows error when issue fetch fails", async () => {
    mockDetail.mockRejectedValueOnce(new Error("Issue missing"));
    renderIssue();
    expect(await screen.findByText(/Issue missing/)).toBeInTheDocument();
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
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Status updated");
  });

  it("opens the issue in Jira", async () => {
    const user = userEvent.setup();
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    await user.click(screen.getByRole("button", { name: "Open in Jira" }));
    expect(mockOpenUrl).toHaveBeenCalledWith(
      "https://example.atlassian.net/browse/HS-165",
    );
  });

  it("toasts when opening in Jira fails", async () => {
    const user = userEvent.setup();
    mockOpenUrl.mockRejectedValueOnce(new Error("Cannot open URL"));
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    await user.click(screen.getByRole("button", { name: "Open in Jira" }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: Cannot open URL",
      ),
    );
  });

  it("toasts when status update fails", async () => {
    const user = userEvent.setup();
    mockTransition.mockRejectedValueOnce(new Error("Transition blocked"));
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    await user.click(screen.getByLabelText("New status"));
    await user.click(screen.getByRole("option", { name: /Done/ }));
    await user.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: Transition blocked",
      ),
    );
  });

  it("handles missing transitions gracefully", async () => {
    mockTransitions.mockResolvedValueOnce([]);
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    expect(screen.getByLabelText("New status")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Update status" }),
    ).toBeDisabled();
  });

  it("continues when transitions fetch fails", async () => {
    mockTransitions.mockRejectedValueOnce(new Error("transitions down"));
    renderIssue();
    expect(
      await screen.findByRole("heading", { name: "HS-165" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New status")).toBeDisabled();
  });

  it("renders parent link, subtasks, labels, and empty description states", async () => {
    mockDetail.mockResolvedValueOnce({
      ...detail,
      parent: {
        key: "HS-100",
        summary: "Parent epic",
        typeName: "Epic",
        typeSubtask: false,
      },
      subtaskKeys: ["HS-166", "HS-167"],
      descriptionText: "",
    });
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    expect(screen.getByRole("link", { name: /HS-100/ })).toHaveAttribute(
      "href",
      "/jira/HS-100",
    );
    expect(screen.getByRole("link", { name: "HS-166" })).toHaveAttribute(
      "href",
      "/jira/HS-166",
    );
    expect(screen.getByText("ttd-fe-88")).toBeInTheDocument();
    expect(screen.getByText("No description.")).toBeInTheDocument();
    expect(screen.queryByText("No sub-tasks")).not.toBeInTheDocument();
  });

  it("renders subtask badge, unassigned assignee, and done status styling", async () => {
    mockDetail.mockResolvedValueOnce({
      ...detail,
      status: { id: "3", name: "Done.", category: "done" },
      type: { id: "5", name: "Sub-task", iconUrl: "", subtask: true },
      assignee: null,
      storyPoints: null,
      priority: null,
      updatedAt: "",
      parent: null,
      subtaskKeys: [],
      labels: [],
      descriptionText: "Build the list endpoint.",
    });
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    expect(screen.getAllByText("Sub-task").length).toBeGreaterThan(0);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.getByText("Done.")).toBeInTheDocument();
    expect(screen.getByText("No parent")).toBeInTheDocument();
    expect(screen.getByText("No sub-tasks")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders assignee avatar when available", async () => {
    mockDetail.mockResolvedValueOnce({
      ...detail,
      assignee: {
        displayName: "Ikhsan",
        avatarUrl: "https://avatar.example/ikhsan.png",
      },
    });
    renderIssue();
    await screen.findByRole("heading", { name: "HS-165" });
    expect(
      document.querySelector('img[src="https://avatar.example/ikhsan.png"]'),
    ).toBeTruthy();
  });

  it("disables Open in Jira until detail loads", () => {
    let resolveDetail!: (value: JiraIssueDetail) => void;
    mockDetail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );
    renderIssue();
    expect(screen.getByRole("button", { name: "Open in Jira" })).toBeDisabled();
    resolveDetail(detail);
  });
});
