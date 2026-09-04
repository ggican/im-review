import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSettings, saveSettings } from "@/lib/settings";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => ({
  api: {
    validateToken: vi.fn(),
    hasAiKey: vi.fn(),
    aiReviewPr: vi.fn(),
    aiRefineReview: vi.fn(),
  },
}));

vi.mock("@/features/pr/api", () => ({
  fetchPrDetail: vi.fn(),
  fetchPrReviews: vi.fn(),
  fetchPrCiChecks: vi.fn(),
  submitReview: vi.fn(),
  closePullRequest: vi.fn(),
  convertPullRequestToDraft: vi.fn(),
  markPullRequestReady: vi.fn(),
  reopenPullRequest: vi.fn(),
}));

vi.mock("@/features/ai-review/generate", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/ai-review/generate")>();
  return {
    ...actual,
    fetchChangedFiles: vi.fn(),
    buildPatchContext: vi.fn(() => ({ text: "patch", fileCount: 1 })),
  };
});

vi.mock("@/lib/use-settings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/use-settings")>();
  return { ...actual };
});

import { toast } from "sonner";

import { fetchChangedFiles } from "@/features/ai-review/generate";
import {
  closePullRequest,
  convertPullRequestToDraft,
  fetchPrCiChecks,
  fetchPrDetail,
  fetchPrReviews,
  markPullRequestReady,
  reopenPullRequest,
  submitReview,
} from "@/features/pr/api";
import { api } from "@/lib/api";

import { AiReviewPage } from "./ai-review";

const mockValidateToken = vi.mocked(api.validateToken);
const mockHasAiKey = vi.mocked(api.hasAiKey);
const mockAiReviewPr = vi.mocked(api.aiReviewPr);
const mockAiRefineReview = vi.mocked(api.aiRefineReview);
const mockFetchPrDetail = vi.mocked(fetchPrDetail);
const mockFetchChangedFiles = vi.mocked(fetchChangedFiles);
const mockFetchPrReviews = vi.mocked(fetchPrReviews);
const mockFetchPrCiChecks = vi.mocked(fetchPrCiChecks);
const mockSubmitReview = vi.mocked(submitReview);
const mockClosePullRequest = vi.mocked(closePullRequest);
const mockConvertToDraft = vi.mocked(convertPullRequestToDraft);
const mockMarkReady = vi.mocked(markPullRequestReady);
const mockReopenPullRequest = vi.mocked(reopenPullRequest);

const AI_DRAFT_JSON = JSON.stringify({
  summary: "Found issues in patch",
  suggestedEvent: "REQUEST_CHANGES",
  findings: [
    {
      severity: "warning",
      title: "Missing null check",
      body: "Handle null input",
      path: "src/main.ts",
      line: 2,
    },
  ],
});

const REFINED_DRAFT_JSON = JSON.stringify({
  summary: "Two key issues",
  suggestedEvent: "COMMENT",
  findings: [
    {
      severity: "critical",
      title: "Security issue",
      body: "Sanitize input",
      path: "src/main.ts",
      line: 2,
    },
  ],
});

function baseDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    number: 42,
    repo: "acme/app",
    title: "Feature PR",
    url: "https://github.com/acme/app/pull/42",
    state: "open" as const,
    author: { login: "bob", avatarUrl: "" },
    isDraft: false,
    updatedAt: "2026-09-04T12:00:00.000Z",
    createdAt: "2026-09-04T10:00:00.000Z",
    body: "Adds feature",
    headSha: "abc1234",
    nodeId: "PR_42",
    mergedAt: null,
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    reviewers: ["alice"],
    ciStatus: "success" as const,
    ciDescription: "All checks passed",
    headBranch: "feat/x",
    ...overrides,
  };
}

function renderAiReview(path = "/review/acme/app/42") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/review/:owner/:repo/:number"
          element={<AiReviewPage />}
        />
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByText("Feature PR")).toBeInTheDocument();
  });
}

async function runAiToDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /AI review/ }));
  await user.click(screen.getByRole("button", { name: /Run AI review/ }));
  await waitFor(() => {
    expect(screen.getByLabelText("Summary")).toBeInTheDocument();
  });
}

describe("AiReviewPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    saveSettings({
      ...getSettings(),
      refreshIntervalMin: 5,
      theme: "system",
      favoritesOnly: false,
      aiProvider: "cursor",
    });
    mockValidateToken.mockResolvedValue({ login: "alice", avatar_url: "" });
    mockHasAiKey.mockResolvedValue(true);
    mockFetchPrDetail.mockResolvedValue(baseDetail());
    mockFetchChangedFiles.mockResolvedValue([
      {
        filename: "src/main.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1 +1,2 @@\n-old\n+new\n",
      },
    ]);
    mockFetchPrReviews.mockResolvedValue({
      reviews: [],
      latestByUser: [],
      inlineCount: 0,
    });
    mockFetchPrCiChecks.mockResolvedValue({
      overall: "success",
      sha: "abc1234",
      items: [],
      failedCount: 0,
      pendingCount: 0,
      successCount: 0,
    });
    mockAiReviewPr.mockResolvedValue(AI_DRAFT_JSON);
    mockAiRefineReview.mockResolvedValue(REFINED_DRAFT_JSON);
    mockSubmitReview.mockResolvedValue(undefined);
    mockClosePullRequest.mockResolvedValue(undefined);
    mockConvertToDraft.mockResolvedValue(undefined);
    mockMarkReady.mockResolvedValue(undefined);
    mockReopenPullRequest.mockResolvedValue(undefined);
  });

  it("loads PR detail and shows tabs after fetch", async () => {
    renderAiReview();
    await waitForLoaded();
    expect(screen.getByText("Adds feature")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PR detail" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Files \(1\)/ })).toBeInTheDocument();
  });

  it("shows load error when GitHub fetch fails", async () => {
    mockFetchPrDetail.mockRejectedValue(new Error("PR not found"));
    renderAiReview();
    await waitFor(() => {
      expect(screen.getByText(/PR not found/)).toBeInTheDocument();
    });
  });

  it("switches to files tab and shows changed files panel", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /Files/ }));
    expect(screen.getByText("Changed files (1)")).toBeInTheDocument();
  });

  it("loads reviews tab and refreshes on button click", async () => {
    const user = userEvent.setup();
    mockFetchPrReviews.mockResolvedValue({
      reviews: [
        {
          id: 1,
          user: "bob",
          avatarUrl: "",
          state: "APPROVED",
          body: "LGTM",
          submittedAt: "2026-09-04T11:00:00.000Z",
          htmlUrl: "https://github.com/review/1",
          comments: [],
        },
      ],
      latestByUser: [{ user: "bob", avatarUrl: "", state: "APPROVED" }],
      inlineCount: 0,
    });
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /Reviews \(1\)/ }));
    expect(screen.getByText("LGTM")).toBeInTheDocument();
    mockFetchPrReviews.mockClear();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(mockFetchPrReviews).toHaveBeenCalled();
    });
  });

  it("loads CI tab and refreshes checks", async () => {
    const user = userEvent.setup();
    mockFetchPrCiChecks.mockResolvedValue({
      overall: "failure",
      sha: "abc1234",
      items: [
        {
          id: "1",
          name: "build",
          state: "failure",
          description: "Failed",
          targetUrl: "https://ci.example/1",
          source: "check_run",
          updatedAt: "2026-09-04T12:00:00.000Z",
        },
      ],
      failedCount: 1,
      pendingCount: 0,
      successCount: 0,
    });
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /CI \(1 failed\)/ }));
    expect(screen.getByText("Some checks failed")).toBeInTheDocument();
    mockFetchPrCiChecks.mockClear();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => {
      expect(mockFetchPrCiChecks).toHaveBeenCalled();
    });
  });

  it("shows AI tab with run button when key exists", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /AI review/ }));
    expect(screen.getByRole("button", { name: /Run AI review/ })).toBeEnabled();
  });

  it("runs AI review and shows draft", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await runAiToDraft(user);
    expect(screen.getByDisplayValue("Found issues in patch")).toBeInTheDocument();
    expect(screen.getByText("Missing null check")).toBeInTheDocument();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "AI draft ready — review before submitting",
    );
  });

  it("shows toast when running AI without API key", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /AI review/ }));
    mockHasAiKey.mockResolvedValue(false);
    await user.click(screen.getByRole("button", { name: /Run AI review/ }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Add a Cursor API key in Settings first",
    );
  });

  it("refines draft via chip and custom instruction", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await runAiToDraft(user);

    await user.click(screen.getByRole("button", { name: "Only 2 findings" }));
    await waitFor(() => {
      expect(mockAiRefineReview).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Two key issues")).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/Custom:/),
      "make it friendlier",
    );
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(mockAiRefineReview).toHaveBeenCalledTimes(2);
  });

  it("toggles findings, confirms, and submits review", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await runAiToDraft(user);

    const findingCheckbox = screen.getAllByRole("checkbox")[0]!;
    await user.click(findingCheckbox);

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: /I reviewed these findings/,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Submit review to GitHub" }),
    );

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        expect.objectContaining({ number: 42, repo: "acme/app" }),
        "APPROVE",
        expect.any(String),
        expect.objectContaining({ commitId: "abc1234" }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("quick approves from header button", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("button", { name: "Approve LGTM" }));
    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith(
        expect.objectContaining({ number: 42 }),
        "APPROVE",
        expect.any(String),
        expect.objectContaining({ commitId: "abc1234" }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("shows empty patch error when AI context is blank", async () => {
    const user = userEvent.setup();
    const { buildPatchContext } = await import("@/features/ai-review/generate");
    vi.mocked(buildPatchContext).mockReturnValueOnce({ text: "  ", fileCount: 0 });
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /AI review/ }));
    await user.click(screen.getByRole("button", { name: /Run AI review/ }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "No reviewable patch content from GitHub",
    );
  });

  it("discards draft and re-runs AI", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await runAiToDraft(user);
    await user.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(screen.queryByLabelText("Summary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Run AI review/ }));
    await waitFor(() => {
      expect(mockAiReviewPr).toHaveBeenCalledTimes(2);
    });
  });

  it("shows reviews error when fetch fails on load", async () => {
    const user = userEvent.setup();
    mockFetchPrReviews.mockRejectedValue(new Error("reviews failed"));
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("tab", { name: /Reviews/ }));
    expect(screen.getByText(/reviews failed/)).toBeInTheDocument();
  });

  it("favorites and unfavorites branch", async () => {
    const user = userEvent.setup();
    renderAiReview();
    await waitForLoaded();
    await user.click(screen.getByRole("button", { name: "Favorite branch" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Favorited branch feat/x",
    );
    await user.click(screen.getByRole("button", { name: "Branch favorited" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Removed favorite feat/x",
    );
  });

  describe("owner PR controls", () => {
    beforeEach(() => {
      mockFetchPrDetail.mockResolvedValue(
        baseDetail({ author: { login: "alice", avatarUrl: "" } }),
      );
    });

    it("closes PR after confirm dialog", async () => {
      const user = userEvent.setup();
      renderAiReview();
      await waitForLoaded();
      await user.click(screen.getByRole("button", { name: "Close PR" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Close PR" }),
      );
      await waitFor(() => {
        expect(mockClosePullRequest).toHaveBeenCalled();
      });
      expect(screen.getByText("Status: closed")).toBeInTheDocument();
    });

    it("converts to draft after confirm dialog", async () => {
      const user = userEvent.setup();
      renderAiReview();
      await waitForLoaded();
      await user.click(screen.getByRole("button", { name: "Convert to draft" }));
      const dialog = screen.getByRole("dialog");
      await user.click(
        within(dialog).getByRole("button", { name: "Convert to draft" }),
      );
      await waitFor(() => {
        expect(mockConvertToDraft).toHaveBeenCalledWith("PR_42");
      });
      expect(screen.getByText("Status: draft")).toBeInTheDocument();
    });

    it("marks draft PR ready for review", async () => {
      const user = userEvent.setup();
      mockFetchPrDetail.mockResolvedValue(
        baseDetail({
          author: { login: "alice", avatarUrl: "" },
          isDraft: true,
        }),
      );
      renderAiReview();
      await waitForLoaded();
      await user.click(
        screen.getByRole("button", { name: "Mark ready for review" }),
      );
      await waitFor(() => {
        expect(mockMarkReady).toHaveBeenCalled();
      });
    });

    it("reopens closed PR", async () => {
      const user = userEvent.setup();
      mockFetchPrDetail.mockResolvedValue(
        baseDetail({
          author: { login: "alice", avatarUrl: "" },
          state: "closed",
        }),
      );
      renderAiReview();
      await waitForLoaded();
      await user.click(screen.getByRole("button", { name: "Reopen PR" }));
      await waitFor(() => {
        expect(mockReopenPullRequest).toHaveBeenCalled();
      });
    });
  });
});
