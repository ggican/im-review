import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

vi.mock("@/lib/api", () => ({
  api: {
    githubGet: vi.fn(),
    githubRequest: vi.fn(),
  },
}));

import { api } from "@/lib/api";

import {
  closePullRequest,
  convertPullRequestToDraft,
  fetchAssignedPrs,
  fetchAuthoredPrsInWindow,
  fetchHeadBranch,
  fetchMergedPrsInWindow,
  fetchMyOpenPrs,
  fetchPrCiChecks,
  fetchPrCommitCount,
  fetchPrDetail,
  fetchPrReviews,
  fetchReviewedPrsInWindow,
  fetchReviewRequestedPrs,
  markPullRequestReady,
  metricsWindowFrom,
  postIssueComment,
  reopenPullRequest,
  submitReview,
} from "./api";

const githubGet = vi.mocked(api.githubGet);
const githubRequest = vi.mocked(api.githubRequest);

const searchItem = {
  id: 1,
  number: 10,
  title: "Hello",
  html_url: "https://github.com/acme/web/issues/10",
  state: "open",
  draft: false,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-02T00:00:00Z",
  repository_url: "https://api.github.com/repos/acme/web",
  user: { login: "alice", avatar_url: "a" },
  pull_request: { html_url: "https://github.com/acme/web/pull/10" },
};

describe("UNIT-API pr/api", () => {
  beforeEach(() => {
    githubGet.mockReset();
    githubRequest.mockReset();
  });

  it("UNIT-API-006 metricsWindowFrom", () => {
    const today = metricsWindowFrom(0);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const week = metricsWindowFrom(7);
    expect(week < today || week <= today).toBe(true);
  });

  it("UNIT-API-007 search mappers", async () => {
    githubGet.mockResolvedValue({ items: [searchItem] });
    const assigned = await fetchAssignedPrs();
    expect(assigned[0]?.repo).toBe("acme/web");
    expect(assigned[0]?.url).toContain("/pull/10");
    await fetchReviewRequestedPrs();
    await fetchMyOpenPrs();
    await fetchAuthoredPrsInWindow("2026-09-01");
    await fetchReviewedPrsInWindow("2026-09-01");
    await fetchMergedPrsInWindow("2026-09-01");
    expect(githubGet.mock.calls.length).toBeGreaterThanOrEqual(6);
  });

  it("UNIT-API-008 fetchPrDetail", async () => {
    githubGet
      .mockResolvedValueOnce({
        id: 1,
        node_id: "PR_1",
        number: 10,
        title: "T",
        html_url: "https://github.com/acme/web/pull/10",
        state: "open",
        draft: false,
        body: " body ",
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-02T00:00:00Z",
        additions: 5,
        deletions: 1,
        changed_files: 2,
        merged_at: null,
        user: { login: "alice", avatar_url: "" },
        head: { sha: "sha1", ref: "feat/x" },
        requested_reviewers: [{ login: "bob" }],
      })
      .mockResolvedValueOnce([
        {
          id: 9,
          user: { login: "carol", avatar_url: "" },
          state: "APPROVED",
          body: "ok",
          submitted_at: "2026-09-02T00:00:00Z",
          html_url: "u",
        },
      ])
      .mockResolvedValueOnce({
        state: "failure",
        statuses: [
          {
            context: "ci",
            state: "failure",
            description: "fail",
            target_url: null,
          },
        ],
      });

    const detail = await fetchPrDetail(
      makePr({ repo: "acme/web", number: 10 }),
    );
    expect(detail.headBranch).toBe("feat/x");
    expect(detail.reviewers).toEqual(expect.arrayContaining(["bob", "carol"]));
    expect(detail.ciStatus).toBe("failure");
    expect(detail.ciDescription).toContain("ci");
  });

  it("UNIT-API-009 fetchPrCiChecks", async () => {
    githubGet
      .mockResolvedValueOnce({
        state: "pending",
        statuses: [
          {
            id: 1,
            context: "jenkins",
            state: "failure",
            description: "red",
            target_url: "http://j",
            updated_at: "2026-09-01T00:00:00Z",
          },
        ],
      })
      .mockResolvedValueOnce({
        total_count: 2,
        check_runs: [
          {
            id: 2,
            name: "build",
            status: "completed",
            conclusion: "success",
            html_url: "h",
            details_url: "d",
            output: { title: "ok", summary: null },
            completed_at: "2026-09-01T01:00:00Z",
            started_at: null,
          },
          {
            id: 3,
            name: "lint",
            status: "in_progress",
            conclusion: null,
            html_url: null,
            completed_at: null,
            started_at: "2026-09-01T00:30:00Z",
          },
        ],
      });

    const snap = await fetchPrCiChecks(
      makePr({ repo: "acme/web", number: 1 }),
      "sha",
    );
    expect(snap.overall).toBe("failure");
    expect(snap.failedCount).toBe(1);
    expect(snap.pendingCount).toBe(1);
    expect(snap.successCount).toBe(1);
    expect(snap.items[0]?.state).toBe("failure");
  });

  it("UNIT-API-010 fetchPrReviews", async () => {
    githubGet
      .mockResolvedValueOnce([
        {
          id: 1,
          user: { login: "bob", avatar_url: "" },
          state: "PENDING",
          body: null,
          submitted_at: null,
          html_url: "u",
        },
        {
          id: 2,
          user: { login: "bob", avatar_url: "" },
          state: "CHANGES_REQUESTED",
          body: "fix",
          submitted_at: "2026-09-02T00:00:00Z",
          html_url: "u2",
        },
        {
          id: 3,
          user: { login: "carol", avatar_url: "" },
          state: "APPROVED",
          body: "",
          submitted_at: "2026-09-03T00:00:00Z",
          html_url: "u3",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          pull_request_review_id: 2,
          path: "a.ts",
          line: 3,
          body: "nit",
          user: { login: "bob", avatar_url: "" },
          created_at: "2026-09-02T00:00:00Z",
          html_url: "c",
        },
        {
          id: 11,
          pull_request_review_id: null,
          path: "b.ts",
          line: null,
          body: "orphan",
          user: null,
          created_at: "2026-09-02T00:00:00Z",
          html_url: "c2",
        },
      ]);

    const snap = await fetchPrReviews(makePr({ repo: "acme/web", number: 1 }));
    expect(snap.reviews).toHaveLength(2);
    expect(snap.inlineCount).toBe(2);
    expect(snap.reviews[0]?.user).toBe("carol");
    expect(snap.latestByUser[0]?.user).toBe("carol");
  });

  it("UNIT-API-011/012 submit + mutations", async () => {
    await expect(
      submitReview(makePr({ repo: "acme/web", number: 1 }), "COMMENT", "  "),
    ).rejects.toThrow(/required/i);

    githubRequest.mockResolvedValueOnce({});
    await submitReview(makePr({ repo: "acme/web", number: 1 }), "APPROVE", "");
    githubRequest.mockResolvedValueOnce({});
    await submitReview(
      makePr({ repo: "acme/web", number: 1 }),
      "COMMENT",
      "hi",
      {
        commitId: "sha",
        comments: [{ path: "a.ts", body: "x", line: 1 }],
      },
    );

    await expect(
      postIssueComment(makePr({ repo: "acme/web", number: 1 }), "  "),
    ).rejects.toThrow(/empty/i);
    githubRequest.mockResolvedValueOnce({});
    await postIssueComment(makePr({ repo: "acme/web", number: 1 }), "note");

    githubRequest.mockResolvedValueOnce({});
    await closePullRequest(makePr({ repo: "acme/web", number: 1 }));
    githubRequest.mockResolvedValueOnce({});
    await reopenPullRequest(makePr({ repo: "acme/web", number: 1 }));
    githubRequest.mockResolvedValueOnce({});
    await markPullRequestReady(makePr({ repo: "acme/web", number: 1 }));

    await expect(convertPullRequestToDraft("")).rejects.toThrow(/node id/i);
    githubRequest.mockResolvedValueOnce({
      errors: [{ message: "denied" }],
    });
    await expect(convertPullRequestToDraft("PR_1")).rejects.toThrow(/denied/);
    githubRequest.mockResolvedValueOnce({ data: {} });
    await convertPullRequestToDraft("PR_1");
  });

  it("UNIT-API-013/014 head branch + commits", async () => {
    await expect(
      fetchHeadBranch(
        makePr({ repo: "acme/web", number: 1, headBranch: "feat/y" }),
      ),
    ).resolves.toBe("feat/y");

    githubGet.mockResolvedValueOnce({ head: { ref: "feat/z" } });
    await expect(
      fetchHeadBranch(makePr({ repo: "acme/web", number: 1 })),
    ).resolves.toBe("feat/z");

    await expect(
      fetchHeadBranch(makePr({ repo: "bad", number: 1 })),
    ).rejects.toThrow(/Invalid repo/);

    githubGet.mockResolvedValueOnce([{ sha: "a" }, { sha: "b" }]);
    await expect(
      fetchPrCommitCount(makePr({ repo: "acme/web", number: 1 })),
    ).resolves.toBe(2);
  });
});
