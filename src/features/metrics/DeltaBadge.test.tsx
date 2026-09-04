import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeltaBadge, scoreBand } from "./DeltaBadge";

describe("DeltaBadge", () => {
  it("renders em dash for null trend", () => {
    render(<DeltaBadge trend={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders em dash when pct is null", () => {
    render(<DeltaBadge trend={{ current: 80, previous: 70, pct: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders up trend with plus sign", () => {
    render(<DeltaBadge trend={{ current: 85, previous: 70, pct: 12 }} />);
    expect(screen.getByText("+12%")).toBeInTheDocument();
  });

  it("renders down trend without forced plus", () => {
    render(<DeltaBadge trend={{ current: 50, previous: 70, pct: -8 }} />);
    expect(screen.getByText("-8%")).toBeInTheDocument();
  });

  it("renders neutral trend for small changes", () => {
    render(<DeltaBadge trend={{ current: 71, previous: 70, pct: 0.2 }} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("scoreBand", () => {
  it("returns Elite for high scores", () => {
    expect(scoreBand(80)).toBe("Elite");
    expect(scoreBand(95)).toBe("Elite");
  });

  it("returns On track for mid scores", () => {
    expect(scoreBand(60)).toBe("On track");
    expect(scoreBand(79)).toBe("On track");
  });

  it("returns Needs focus for low scores", () => {
    expect(scoreBand(59)).toBe("Needs focus");
    expect(scoreBand(0)).toBe("Needs focus");
  });
});
