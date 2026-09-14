import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSettings,
  getTemplates,
  saveGooglePublic,
  saveJiraPublic,
  saveReviewLocally,
  saveSettings,
  toggleFavorite,
  toggleFavoriteBranch,
} from "@/lib/settings";

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
    listAiProviderStatus: vi.fn(),
    deleteToken: vi.fn(),
    validateAiKey: vi.fn(),
    saveAiKey: vi.fn(),
    deleteAiKey: vi.fn(),
    validateJira: vi.fn(),
    saveJira: vi.fn(),
    deleteJira: vi.fn(),
    connectGoogle: vi.fn(),
    cancelGoogleConnect: vi.fn(),
    deleteGoogle: vi.fn(),
  },
}));

vi.mock("@/lib/google-oauth", () => ({
  GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
  isGoogleOAuthConfigured: () => true,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

import { api } from "@/lib/api";

import { SettingsPage } from "./settings";

const mockListAiProviderStatus = vi.mocked(api.listAiProviderStatus);
const mockValidateAiKey = vi.mocked(api.validateAiKey);
const mockSaveAiKey = vi.mocked(api.saveAiKey);
const mockDeleteAiKey = vi.mocked(api.deleteAiKey);
const mockDeleteToken = vi.mocked(api.deleteToken);
const mockValidateJira = vi.mocked(api.validateJira);
const mockSaveJira = vi.mocked(api.saveJira);
const mockDeleteJira = vi.mocked(api.deleteJira);
const mockConnectGoogle = vi.mocked(api.connectGoogle);
const mockCancelGoogleConnect = vi.mocked(api.cancelGoogleConnect);
const mockDeleteGoogle = vi.mocked(api.deleteGoogle);
const mockListen = vi.mocked(listen);

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    saveSettings({
      ...getSettings(),
      refreshIntervalMin: 5,
      theme: "system",
      favoritesOnly: false,
      aiProvider: "cursor",
      showFavoritePeople: false,
    });
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: true },
      { id: "openai", has_key: false },
    ]);
    mockValidateAiKey.mockResolvedValue(undefined);
    mockSaveAiKey.mockResolvedValue(undefined);
    mockDeleteAiKey.mockResolvedValue(undefined);
    mockDeleteToken.mockResolvedValue(undefined);
    mockValidateJira.mockResolvedValue({
      account_id: "acc",
      display_name: "Alice",
      email: "alice@example.com",
      avatar_url: "",
      host: "https://acme.atlassian.net",
    });
    mockSaveJira.mockResolvedValue(undefined);
    mockDeleteJira.mockResolvedValue(undefined);
    mockConnectGoogle.mockResolvedValue({
      email: "alice@gmail.com",
      name: "Alice G",
      access_token: "at",
      refresh_token: "rt",
      expiry: 1,
    });
    mockCancelGoogleConnect.mockResolvedValue(undefined);
    mockDeleteGoogle.mockResolvedValue(undefined);
    mockListen.mockImplementation(async () => () => {});
    saveJiraPublic(null);
    saveGooglePublic(null);
  });

  it("renders page header and general tab content", async () => {
    renderSettings();
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Auto refresh")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockListAiProviderStatus).toHaveBeenCalled();
    });
  });

  it("switches to AI, templates, favorites, and history tabs", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: "AI" }));
    expect(screen.getByText("AI providers")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Templates/ }));
    expect(screen.getByText("Comment templates")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(screen.getByText("Favorite repos")).toBeInTheDocument();
    expect(screen.getByText("Favorite people")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Jira/ }));
    expect(screen.getByText("Jira Cloud")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Google/ }));
    expect(screen.getByText(/Google \(Calendar & Gmail\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Submitted review history")).toBeInTheDocument();
  });

  it("toggles showFavoritePeople on general tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(getSettings().showFavoritePeople).toBe(false);
    await user.click(
      screen.getByRole("button", { name: "Show People tab" }),
    );
    expect(getSettings().showFavoritePeople).toBe(true);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(getSettings().showFavoritePeople).toBe(false);
  });

  it("changes refresh interval and theme on general tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(getSettings().refreshIntervalMin).toBe(0);

    await user.click(screen.getByRole("button", { name: "light" }));
    expect(getSettings().theme).toBe("light");
    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(getSettings().theme).toBe("dark");
  });

  it("reconnects GitHub PAT", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: "Reconnect GitHub PAT" }),
    );
    await waitFor(() => {
      expect(mockDeleteToken).toHaveBeenCalled();
    });
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true });
  });

  it("saves, validates, and removes AI key", async () => {
    const user = userEvent.setup();
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: false },
      { id: "openai", has_key: false },
    ]);
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "AI" }));

    const input = screen.getByPlaceholderText(/cursor_/i);
    await user.type(input, "sk-test-key");
    await user.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => {
      expect(mockValidateAiKey).toHaveBeenCalledWith("cursor", "sk-test-key");
      expect(mockSaveAiKey).toHaveBeenCalledWith("cursor", "sk-test-key");
    });

    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: true },
      { id: "openai", has_key: false },
    ]);
    await user.click(screen.getByRole("button", { name: "Remove key" }));
    await waitFor(() => {
      expect(mockDeleteAiKey).toHaveBeenCalledWith("cursor");
    });
  });

  it("saves and removes Jira API key like other tokens", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Jira/ }));
    expect(screen.getByText("No key")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get token" })).toHaveAttribute(
      "href",
      "https://id.atlassian.com/manage-profile/security/api-tokens",
    );

    await user.type(
      screen.getByLabelText("Jira site URL"),
      "https://acme.atlassian.net",
    );
    await user.type(screen.getByLabelText("Jira email"), "alice@example.com");
    await user.type(screen.getByLabelText("Jira API token"), "jira-token");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    await waitFor(() => {
      expect(mockValidateJira).toHaveBeenCalledWith({
        host: "https://acme.atlassian.net",
        email: "alice@example.com",
        token: "jira-token",
      });
      expect(mockSaveJira).toHaveBeenCalledWith({
        host: "https://acme.atlassian.net",
        email: "alice@example.com",
        token: "jira-token",
      });
    });
    expect(screen.getByText("Key saved")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove key" }));
    await waitFor(() => {
      expect(mockDeleteJira).toHaveBeenCalled();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Jira API key removed",
    );
  });

  it("connects and disconnects Google via OAuth", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    expect(screen.getByText("Not connected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect Google" }));

    await waitFor(() => {
      expect(mockConnectGoogle).toHaveBeenCalled();
    });
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Alice G")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(mockDeleteGoogle).toHaveBeenCalled();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Google disconnected",
    );
  });

  it("UNIT-GOOGLE-010/011 shows copyable URL and cancel while waiting", async () => {
    const user = userEvent.setup();
    let resolveConnect!: (value: {
      email: string;
      name: string;
      access_token: string;
      refresh_token: string;
      expiry: number;
    }) => void;
    mockConnectGoogle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConnect = resolve;
        }),
    );
    let onOauthUrl: ((event: { payload: string }) => void) | undefined;
    mockListen.mockImplementation(async (event, handler) => {
      if (event === "google-oauth-url") {
        onOauthUrl = handler as (event: { payload: string }) => void;
      }
      return () => {};
    });
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Connect Google" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
    expect(onOauthUrl).toBeTypeOf("function");
    onOauthUrl!({
      payload: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Google sign-in URL")).toHaveValue(
        "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      );
    });
    await user.click(screen.getByRole("button", { name: "Copy URL" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockCancelGoogleConnect).toHaveBeenCalled();

    resolveConnect({
      email: "alice@gmail.com",
      name: "Alice G",
      access_token: "at",
      refresh_token: "rt",
      expiry: 1,
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });
  });

  it("UNIT-GOOGLE-012 soft-toasts cancelled Google sign-in", async () => {
    const user = userEvent.setup();
    mockConnectGoogle.mockRejectedValueOnce(
      new Error("Google sign-in cancelled"),
    );
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Connect Google" }));
    await waitFor(() => {
      expect(vi.mocked(toast.message)).toHaveBeenCalledWith(
        "Google sign-in cancelled",
      );
    });
    expect(vi.mocked(toast.error)).not.toHaveBeenCalledWith(
      expect.stringMatching(/sign-in cancelled/i),
    );
  });

  it("creates, edits, and deletes templates", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Templates/ }));

    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Template name"), "Ship it");
    await user.type(
      screen.getByPlaceholderText("Comment body"),
      "LGTM, ship when ready",
    );
    await user.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => {
      expect(getTemplates().some((t) => t.name === "Ship it")).toBe(true);
    });

    await user.click(screen.getAllByRole("button", { name: /Ship it/ })[0]!);
    await user.clear(screen.getByPlaceholderText("Template name"));
    await user.type(screen.getByPlaceholderText("Template name"), "Ship it v2");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    await user.click(screen.getByRole("button", { name: "Delete Ship it v2" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Template deleted");
  });

  it("manages favorite repos and branches", async () => {
    const user = userEvent.setup();
    toggleFavorite("acme/alpha");
    toggleFavoriteBranch({
      repo: "acme/app",
      branch: "feat/y",
      prNumber: 5,
      title: "Branch PR",
      url: "https://github.com/acme/app/pull/5",
    });

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));

    expect(screen.getByText("acme/alpha")).toBeInTheDocument();
    expect(screen.getByText("Branch PR")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove acme/alpha" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Removed acme/alpha");

    await user.click(
      screen.getByRole("button", { name: "Remove favorite branch" }),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Removed favorite branch",
    );
  });

  it("deletes saved review from history", async () => {
    const user = userEvent.setup();
    saveReviewLocally({
      repo: "acme/app",
      prNumber: 99,
      prTitle: "History PR",
      prUrl: "https://github.com/acme/app/pull/99",
      branch: "feat/h",
      event: "COMMENT",
      summary: "Nice work",
      body: "Nice work",
      comments: [],
    });
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("History PR")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Delete saved review" }),
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Removed from history",
    );
  });

  it("validates template fields and restores default favorites", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Templates/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Save template" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Name and body are required",
    );

    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Default favorite repos restored",
    );
  });
});
