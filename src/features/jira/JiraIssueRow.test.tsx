import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JiraIssueRow } from "./JiraIssueRow";
import type { JiraIssue } from "./types";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

const baseIssue: JiraIssue = {
  id: "1",
  key: "TIX-1",
  summary: "Fix login",
  status: { id: "1", name: "In Progress", category: "indeterminate" },
  type: { id: "2", name: "Bug", iconUrl: "", subtask: false },
  parent: null,
  labels: [],
  assignee: { displayName: "Ikhsan Mahendri", avatarUrl: "" },
  priority: "High",
  updatedAt: "2026-01-01T00:00:00.000Z",
  browseUrl: "https://jira.example.com/browse/TIX-1",
  devStart: null,
  devEnd: null,
  storyPoints: 3,
};

function renderRow(issue: JiraIssue) {
  return render(
    <MemoryRouter>
      <ul>
        <JiraIssueRow issue={issue} />
      </ul>
    </MemoryRouter>,
  );
}

describe("JiraIssueRow", () => {
  beforeEach(() => {
    vi.mocked(openUrl).mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it("renders status badge variants by category", () => {
    const { rerender } = renderRow(baseIssue);
    expect(screen.getByText("In Progress")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ul>
          <JiraIssueRow
            issue={{
              ...baseIssue,
              status: { id: "2", name: "Done", category: "done" },
            }}
          />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ul>
          <JiraIssueRow
            issue={{
              ...baseIssue,
              status: { id: "3", name: "To Do", category: "new" },
            }}
          />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByText("To Do")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ul>
          <JiraIssueRow
            issue={{
              ...baseIssue,
              status: { id: "4", name: "Unknown", category: "unknown" },
            }}
          />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows assignee initials when avatar is missing", () => {
    renderRow(baseIssue);
    expect(screen.getByText("IM")).toBeInTheDocument();
    expect(screen.getByText("Ikhsan Mahendri")).toBeInTheDocument();
  });

  it("opens issue in Jira", async () => {
    const user = userEvent.setup();
    vi.mocked(openUrl).mockResolvedValue(undefined);
    renderRow(baseIssue);

    await user.click(
      screen.getByRole("button", { name: "Open TIX-1 in Jira" }),
    );

    expect(openUrl).toHaveBeenCalledWith(
      "https://jira.example.com/browse/TIX-1",
    );
  });

  it("toasts when open in Jira fails", async () => {
    const user = userEvent.setup();
    vi.mocked(openUrl).mockRejectedValue(new Error("blocked"));
    renderRow(baseIssue);

    await user.click(
      screen.getByRole("button", { name: "Open TIX-1 in Jira" }),
    );

    expect(toast.error).toHaveBeenCalledWith("Error: blocked");
  });
});
