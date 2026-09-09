import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePr } from "@/test/fixtures";

import type { Repo } from "./types";

const mockFetchOpenPullsForRepo = vi.fn();

vi.mock("@/features/pr/api", () => ({
  fetchOpenPullsForRepo: (...args: unknown[]) =>
    mockFetchOpenPullsForRepo(...args),
}));

import { RepoOpenBranchesPanel } from "./RepoOpenBranchesPanel";

const repo: Repo = {
  id: 1,
  fullName: "acme/alpha",
  description: "Alpha",
  private: false,
  htmlUrl: "https://github.com/acme/alpha",
  updatedAt: "2026-09-04T12:00:00.000Z",
  language: "TypeScript",
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe("RepoOpenBranchesPanel", () => {
  beforeEach(() => {
    mockFetchOpenPullsForRepo.mockReset();
  });

  it("lists open PRs and navigates to review", async () => {
    const user = userEvent.setup();
    mockFetchOpenPullsForRepo.mockResolvedValue([
      makePr({
        repo: "acme/alpha",
        number: 7,
        title: "Add feature",
        headBranch: "feat/alpha-1",
        isDraft: true,
      }),
      makePr({
        repo: "acme/alpha",
        number: 8,
        title: "No branch",
        headBranch: undefined,
      }),
    ]);

    const onBack = vi.fn();
    render(
      <MemoryRouter initialEntries={["/repos"]}>
        <Routes>
          <Route
            path="/repos"
            element={<RepoOpenBranchesPanel repo={repo} onBack={onBack} />}
          />
          <Route
            path="/review/:owner/:name/:number"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("feat/alpha-1")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByText("(unknown branch)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add feature/ }));
    expect(screen.getByTestId("loc")).toHaveTextContent("/review/acme/alpha/7");
  });

  it("shows error and empty states", async () => {
    mockFetchOpenPullsForRepo.mockRejectedValueOnce(new Error("denied"));
    const { rerender } = render(
      <MemoryRouter>
        <RepoOpenBranchesPanel repo={repo} onBack={vi.fn()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Error: denied/)).toBeInTheDocument();

    mockFetchOpenPullsForRepo.mockResolvedValueOnce([]);
    rerender(
      <MemoryRouter>
        <RepoOpenBranchesPanel
          repo={{ ...repo, fullName: "acme/empty" }}
          onBack={vi.fn()}
        />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(
        screen.getByText(/No open pull requests in this repo/),
      ).toBeInTheDocument();
    });
  });
});
