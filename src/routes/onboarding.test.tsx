import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    saveToken: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

import { api } from "@/lib/api";

import { OnboardingPage } from "./onboarding";

const mockValidateToken = vi.mocked(api.validateToken);
const mockSaveToken = vi.mocked(api.saveToken);
const mockToastSuccess = vi.mocked(toast.success);
const mockToastError = vi.mocked(toast.error);

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockValidateToken.mockReset();
    mockSaveToken.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
  });

  it("does nothing on empty submit", async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("validates token, saves, toasts, and navigates on success", async () => {
    const user = userEvent.setup();
    mockValidateToken.mockResolvedValue({
      login: "alice",
      name: "Alice",
      avatar_url: "",
    });
    mockSaveToken.mockResolvedValue(undefined);
    renderOnboarding();

    await user.type(
      screen.getByLabelText(/GitHub personal access token/i),
      "ghp_test_token",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockValidateToken).toHaveBeenCalledWith("ghp_test_token");
      expect(mockSaveToken).toHaveBeenCalledWith("ghp_test_token");
      expect(mockToastSuccess).toHaveBeenCalledWith("Signed in as @alice");
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows error toast when validation fails", async () => {
    const user = userEvent.setup();
    mockValidateToken.mockRejectedValue(new Error("bad token"));
    renderOnboarding();

    await user.type(
      screen.getByLabelText(/GitHub personal access token/i),
      "bad",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Error: bad token");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
