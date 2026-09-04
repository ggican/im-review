import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BrandMark, PageHeader, PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders children with default width", () => {
    render(
      <PageShell>
        <p>Page content</p>
      </PageShell>,
    );
    expect(screen.getByRole("main")).toHaveClass("max-w-3xl");
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("supports lg width and custom className", () => {
    render(
      <PageShell width="lg" className="extra">
        <p>Wide page</p>
      </PageShell>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("max-w-4xl", "extra");
  });
});

describe("PageHeader", () => {
  it("renders title, subtitle, actions, and leading", () => {
    render(
      <PageHeader
        title="Dashboard"
        subtitle="Your PRs"
        leading={<span data-testid="leading">L</span>}
        actions={<button type="button">Action</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your PRs")).toBeInTheDocument();
    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  });

  it("renders back link when backTo is set", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <PageHeader title="Settings" backTo="/" />
      </MemoryRouter>,
    );
    const back = screen.getByRole("link", { name: "Back" });
    expect(back).toHaveAttribute("href", "/");
  });
});

describe("BrandMark", () => {
  it("renders logo and product name", () => {
    render(<BrandMark />);
    expect(screen.getByText("IM Review")).toBeInTheDocument();
    expect(screen.getByAltText("")).toBeInTheDocument();
  });
});
