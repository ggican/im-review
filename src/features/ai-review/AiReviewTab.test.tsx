import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AiReviewTab } from "./AiReviewTab";
import type { AiReviewDraft } from "./types";

const draft: AiReviewDraft = {
  prKey: "acme/app#42",
  summary: "Summary text",
  suggestedEvent: "COMMENT",
  rawText: "",
  createdAt: "2026-09-04T12:00:00.000Z",
  findings: [
    {
      id: "f1",
      severity: "critical",
      title: "Race condition",
      body: "Guard the shared cache write.",
      path: "src/a.ts",
      line: 10,
      included: true,
    },
    {
      id: "f2",
      severity: "info",
      title: "Nit",
      body: "Rename for clarity",
      included: false,
    },
  ],
};

function renderTab(overrides: Partial<ComponentProps<typeof AiReviewTab>> = {}) {
  const props: ComponentProps<typeof AiReviewTab> = {
    phase: "ready",
    draft: null,
    logs: [],
    hasAiKey: true,
    aiProviderLabel: "Cursor",
    filesCount: 2,
    confirmed: false,
    posting: false,
    refining: false,
    refineText: "",
    runError: null,
    pendingInlineCount: 0,
    onConfirmedChange: vi.fn(),
    onRefineTextChange: vi.fn(),
    onSummaryChange: vi.fn(),
    onToggleFinding: vi.fn(),
    onIgnoreFinding: vi.fn(),
    onEventChange: vi.fn(),
    onRun: vi.fn(),
    onRefine: vi.fn(),
    onSubmit: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
  return {
    props,
    ...render(
      <MemoryRouter>
        <AiReviewTab {...props} />
      </MemoryRouter>,
    ),
  };
}

describe("AiReviewTab", () => {
  it("shows not-run status and run action", () => {
    renderTab();
    expect(screen.getByText("AI review")).toBeInTheDocument();
    expect(screen.getByText("Not run")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Run AI review/ }),
    ).toBeEnabled();
  });

  it("shows running state and logs", () => {
    renderTab({
      phase: "ai_running",
      logs: [{ step: "github", message: "Using 2 file patch(es)" }],
    });
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(
      screen.getByText(/Cursor AI is reviewing patches/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Using 2 file patch/)).toBeInTheDocument();
  });

  it("renders findings, ignore, confirmation gate, and submit disable rules", async () => {
    const user = userEvent.setup();
    const { props } = renderTab({
      phase: "draft",
      draft,
    });
    expect(screen.getByText("Findings available")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("src/a.ts:10")).toBeInTheDocument();
    expect(screen.getByText("Ignored")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit review to GitHub" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Ignore" }));
    expect(props.onIgnoreFinding).toHaveBeenCalledWith("f1");

    await user.click(
      screen.getByRole("checkbox", { name: /I reviewed these findings/ }),
    );
    expect(props.onConfirmedChange).toHaveBeenCalledWith(true);
  });

  it("enables submit when confirmed and warns when none selected", () => {
    renderTab({
      phase: "draft",
      draft: {
        ...draft,
        findings: draft.findings.map((f) => ({ ...f, included: false })),
      },
      confirmed: true,
    });
    expect(
      screen.getByText(/No findings selected/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit review to GitHub" }),
    ).toBeEnabled();
  });

  it("shows failed and no-findings states", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AiReviewTab
          phase="ready"
          draft={null}
          logs={[]}
          hasAiKey
          aiProviderLabel="Cursor"
          filesCount={1}
          confirmed={false}
          posting={false}
          refining={false}
          refineText=""
          runError="provider down"
          pendingInlineCount={0}
          onConfirmedChange={vi.fn()}
          onRefineTextChange={vi.fn()}
          onSummaryChange={vi.fn()}
          onToggleFinding={vi.fn()}
          onIgnoreFinding={vi.fn()}
          onEventChange={vi.fn()}
          onRun={vi.fn()}
          onRefine={vi.fn()}
          onSubmit={vi.fn()}
          onDiscard={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("provider down")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <AiReviewTab
          phase="draft"
          draft={{ ...draft, findings: [] }}
          logs={[]}
          hasAiKey
          aiProviderLabel="Cursor"
          filesCount={1}
          confirmed={false}
          posting={false}
          refining={false}
          refineText=""
          runError={null}
          pendingInlineCount={0}
          onConfirmedChange={vi.fn()}
          onRefineTextChange={vi.fn()}
          onSummaryChange={vi.fn()}
          onToggleFinding={vi.fn()}
          onIgnoreFinding={vi.fn()}
          onEventChange={vi.fn()}
          onRun={vi.fn()}
          onRefine={vi.fn()}
          onSubmit={vi.fn()}
          onDiscard={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("No findings")).toBeInTheDocument();
    expect(screen.getByText("No findings returned.")).toBeInTheDocument();
  });
});
