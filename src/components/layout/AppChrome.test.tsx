import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/api", () => ({
  api: {
    validateToken: vi.fn(),
    deleteToken: vi.fn(),
  },
}));

vi.mock("@/features/command-palette/CommandPalette", () => ({
  openCommandPalette: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { openCommandPalette } from "@/features/command-palette/CommandPalette";
import { api } from "@/lib/api";

import { AppChrome } from "./AppChrome";

const mockValidateToken = vi.mocked(api.validateToken);
const mockDeleteToken = vi.mocked(api.deleteToken);
const mockOpenPalette = vi.mocked(openCommandPalette);

function renderChrome(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<AppChrome />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppChrome", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockOpenPalette.mockReset();
    mockDeleteToken.mockResolvedValue(undefined);
    mockValidateToken.mockResolvedValue({
      login: "alice",
      name: "Alice",
      avatar_url: "",
    });
    saveSettings({ ...getSettings(), theme: "light" });
  });

  it("renders primary navigation with active Today on home", async () => {
    renderChrome("/");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    const todayLinks = screen.getAllByRole("link", { name: "Today" });
    expect(todayLinks[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Jira" })[0]).toHaveAttribute(
      "href",
      "/jira",
    );
    expect(screen.getAllByRole("link", { name: "Gmail" })[0]).toHaveAttribute(
      "href",
      "/gmail",
    );
    expect(
      screen.getAllByRole("link", { name: "Calendar" })[0],
    ).toHaveAttribute("href", "/calendar");
    expect(screen.getAllByRole("link", { name: "Metrics" })[0]).toHaveAttribute(
      "href",
      "/metrics",
    );
    expect(
      screen.getAllByRole("link", { name: "Settings" })[0],
    ).toHaveAttribute("href", "/settings");
  });

  it("marks Pull Requests active for hub=prs and review routes", async () => {
    renderChrome("/?hub=prs");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(
      screen.getAllByRole("link", { name: "Pull Requests" })[0],
    ).toHaveAttribute("aria-current", "page");
  });

  it("opens command palette and cycles theme", async () => {
    const user = userEvent.setup();
    renderChrome("/");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: "Open command palette" }),
    );
    expect(mockOpenPalette).toHaveBeenCalled();

    expect(getSettings().theme).toBe("light");
    await user.click(screen.getByRole("button", { name: "Light theme" }));
    expect(getSettings().theme).toBe("dark");
  });

  it("handles validateToken failure", async () => {
    mockValidateToken.mockRejectedValueOnce(new Error("expired"));
    renderChrome("/");
    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  it("shows system theme label when system preference is dark", async () => {
    saveSettings({ ...getSettings(), theme: "system" });
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    } as MediaQueryList);
    renderChrome("/");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(
      screen.getAllByRole("button", { name: "System theme" })[0],
    ).toBeInTheDocument();
  });

  it("cycles through dark and system themes", async () => {
    const user = userEvent.setup();
    saveSettings({ ...getSettings(), theme: "dark" });
    renderChrome("/");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(getSettings().theme).toBe("system");
    await user.click(screen.getByRole("button", { name: "System theme" }));
    expect(getSettings().theme).toBe("light");
  });

  it("signs out", async () => {
    const user = userEvent.setup();
    renderChrome("/");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(mockDeleteToken).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });
});
