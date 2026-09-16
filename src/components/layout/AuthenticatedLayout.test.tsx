import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/AppChrome", () => ({
  AppChrome: () => <div data-testid="app-chrome">App chrome</div>,
}));

import { AuthenticatedLayout } from "./AuthenticatedLayout";

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<AuthenticatedLayout />}>
          <Route
            path="/dashboard"
            element={<div data-testid="outlet-child">Dashboard page</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthenticatedLayout", () => {
  it("renders AppChrome and nested route outlet content", () => {
    renderLayout();
    expect(screen.getByTestId("app-chrome")).toBeInTheDocument();
    expect(screen.getByTestId("outlet-child")).toHaveTextContent(
      "Dashboard page",
    );
  });
});
