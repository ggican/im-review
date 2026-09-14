import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PeoplePage } from "./PeoplePage";

describe("PeoplePage", () => {
  it("renders favorites empty state", () => {
    render(
      <MemoryRouter>
        <PeoplePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByText(/No favorite people yet/)).toBeInTheDocument();
  });
});
