import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGithubUser } from "@/features/people/api";
import {
  deleteSavedReview,
  getFavoriteBranches,
  getFavorites,
  getFavoriteUsers,
  getSavedReviews,
  getSettings,
  getTemplates,
  removeFavorite,
  removeFavoriteBranch,
  removeFavoriteUser,
  saveGooglePublic,
  saveJiraPublic,
  saveReviewLocally,
  saveSettings,
  toggleFavorite,
  toggleFavoriteBranch,
  toggleFavoriteUser,
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

vi.mock("@/features/people/api", () => ({
  fetchGithubUser: vi.fn(),
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
const mockFetchGithubUser = vi.mocked(fetchGithubUser);

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
    for (const repo of [...getFavorites()]) {
      removeFavorite(repo);
    }
    for (const branch of [...getFavoriteBranches()]) {
      removeFavoriteBranch(branch.id);
    }
    for (const user of [...getFavoriteUsers()]) {
      removeFavoriteUser(user.login);
    }
    for (const review of [...getSavedReviews()]) {
      deleteSavedReview(review.id);
    }
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
    mockFetchGithubUser.mockResolvedValue({
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "https://github.com/octocat.png",
      htmlUrl: "https://github.com/octocat",
    });
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

    await user.click(screen.getByRole("tab", { name: "AI providers" }));
    expect(screen.getByText("Active provider")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Review templates/ }));
    expect(screen.getByText("Comment templates")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(screen.getByRole("tab", { name: /^Repos/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^People/ })).toBeInTheDocument();
    expect(screen.getByText("Favorite repos")).toBeInTheDocument();
    expect(screen.queryByText("Favorite people")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^People/ }));
    expect(screen.getByText("Favorite people")).toBeInTheDocument();
    expect(screen.queryByText("Favorite repos")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Jira/ }));
    expect(screen.getByText("Jira Cloud")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Google/ }));
    expect(screen.getByText(/Google \(Calendar & Gmail\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "GitHub" }));
    expect(screen.getByText("GitHub PAT")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByText("Submitted review history")).toBeInTheDocument();
  });

  it("toggles showFavoritePeople on general tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    expect(getSettings().showFavoritePeople).toBe(false);
    await user.click(screen.getByRole("button", { name: "Show People tab" }));
    expect(getSettings().showFavoritePeople).toBe(true);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(getSettings().showFavoritePeople).toBe(false);
  });

  it("changes refresh interval and theme on general tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("button", { name: "Off" }));
    expect(getSettings().refreshIntervalMin).toBe(0);

    await user.click(screen.getByRole("button", { name: "system" }));
    expect(getSettings().theme).toBe("system");
    await user.click(screen.getByRole("button", { name: "light" }));
    expect(getSettings().theme).toBe("light");
    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(getSettings().theme).toBe("dark");
  });

  it("opens connection tabs from General overview cards", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(
      screen.getByRole("button", { name: /GitHub.*Token configured/i }),
    );
    expect(screen.getByText("GitHub PAT")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "General" }));
    await user.click(screen.getByRole("button", { name: /Jira.*No key/i }));
    expect(screen.getByText("Atlassian API token")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "General" }));
    await user.click(
      screen.getByRole("button", { name: /Google.*Not connected/i }),
    );
    expect(screen.getByText("Not connected")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "General" }));
    await user.click(screen.getByRole("button", { name: /AI provider/i }));
    expect(screen.getByText("Active provider")).toBeInTheDocument();
  });

  it("reconnects GitHub PAT", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "GitHub" }));
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
    await user.click(screen.getByRole("tab", { name: "AI providers" }));

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

  it("switches focused AI provider chip", async () => {
    const user = userEvent.setup();
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: true },
      { id: "openai", has_key: false },
    ]);
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "AI providers" }));
    await user.click(screen.getAllByRole("button", { name: /OpenAI/i })[0]!);
    expect(screen.getByPlaceholderText(/sk-/i)).toBeInTheDocument();
  });

  it("switches configure-key AI provider focus", async () => {
    const user = userEvent.setup();
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: true },
      { id: "openai", has_key: false },
    ]);
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "AI providers" }));
    const openAiButtons = screen.getAllByRole("button", { name: /OpenAI/i });
    await user.click(openAiButtons[openAiButtons.length - 1]!);
    expect(screen.getByPlaceholderText(/sk-/i)).toBeInTheDocument();
  });

  it("handles listAiProviderStatus failure gracefully", async () => {
    mockListAiProviderStatus.mockRejectedValueOnce(new Error("status down"));
    renderSettings();
    await waitFor(() => {
      expect(mockListAiProviderStatus).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("blocks adding favorite person when at limit", async () => {
    const user = userEvent.setup();
    const { MAX_FAVORITE_USERS } = await import("@/lib/settings");
    for (let i = 0; i < MAX_FAVORITE_USERS; i += 1) {
      toggleFavoriteUser({
        login: `cap${i}`,
        name: null,
        avatarUrl: "",
        htmlUrl: `https://github.com/cap${i}`,
      });
    }
    mockFetchGithubUser.mockResolvedValue({
      login: "one-more",
      name: "One More",
      avatarUrl: "",
      htmlUrl: "https://github.com/one-more",
    });
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    await user.click(screen.getByRole("tab", { name: /^People/ }));
    await user.type(
      screen.getByLabelText("GitHub login to favorite"),
      "one-more",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        `Favorite people limit is ${MAX_FAVORITE_USERS}`,
      );
    });
  });

  it("surfaces AI save failure", async () => {
    const user = userEvent.setup();
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: false },
      { id: "openai", has_key: false },
    ]);
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "AI providers" }));
    await user.type(screen.getByPlaceholderText(/cursor_/i), "bad-key");
    mockValidateAiKey.mockRejectedValueOnce(new Error("invalid ai key"));
    await user.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: invalid ai key",
      );
    });
  });

  it("surfaces AI remove and Google cancel failures", async () => {
    const user = userEvent.setup();
    mockListAiProviderStatus.mockResolvedValue([
      { id: "cursor", has_key: true },
      { id: "openai", has_key: false },
    ]);
    renderSettings();
    await user.click(screen.getByRole("tab", { name: "AI providers" }));
    mockDeleteAiKey.mockRejectedValueOnce(new Error("remove ai fail"));
    await user.click(screen.getByRole("button", { name: "Remove key" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: remove ai fail",
      );
    });

    mockConnectGoogle.mockImplementation(() => new Promise(() => {}));
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Connect Google" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
    });
    mockCancelGoogleConnect.mockRejectedValueOnce(new Error("cancel fail"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Error: cancel fail");
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
      expect(
        screen.getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
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
    const urlInput =
      screen.getByLabelText<HTMLInputElement>("Google sign-in URL");
    const selectSpy = vi.spyOn(urlInput, "select");
    await user.click(urlInput);
    expect(selectSpy).toHaveBeenCalled();
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
      expect(
        screen.queryByRole("button", { name: "Cancel" }),
      ).not.toBeInTheDocument();
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

  it("cancels template editing", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Review templates/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Template name"), "Draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByPlaceholderText("Template name"),
    ).not.toBeInTheDocument();
  });

  it("surfaces copy URL failure during Google connect", async () => {
    const user = userEvent.setup();
    let onOauthUrl: ((event: { payload: string }) => void) | undefined;
    mockConnectGoogle.mockImplementation(() => new Promise(() => {}));
    mockListen.mockImplementation(async (event, handler) => {
      if (event === "google-oauth-url") {
        onOauthUrl = handler as (event: { payload: string }) => void;
      }
      return () => {};
    });
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Connect Google" }));
    onOauthUrl!({
      payload: "https://accounts.google.com/o/oauth2/v2/auth?fail=1",
    });
    await user.click(await screen.findByRole("button", { name: "Copy URL" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Could not copy URL");
  });

  it("cancels Google reconnect while connected", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@gmail.com", name: "Alice G" });
    mockConnectGoogle.mockImplementation(() => new Promise(() => {}));

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Reconnect Google" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mockCancelGoogleConnect).toHaveBeenCalled();
  });

  it("copies Google auth URL while reconnecting", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@gmail.com", name: "Alice G" });
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
    await user.click(screen.getByRole("button", { name: "Reconnect Google" }));
    onOauthUrl!({
      payload: "https://accounts.google.com/o/oauth2/v2/auth?copy=1",
    });
    await user.click(await screen.findByRole("button", { name: "Copy URL" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2/v2/auth?copy=1",
    );
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Sign-in URL copied");
    resolveConnect({
      email: "alice@gmail.com",
      name: "Alice G",
      access_token: "at",
      refresh_token: "rt",
      expiry: 1,
    });
  });

  it("selects Google auth URL on focus while reconnecting", async () => {
    const user = userEvent.setup();
    saveGooglePublic({ email: "alice@gmail.com", name: "Alice G" });
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

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Reconnect Google" }));
    onOauthUrl!({
      payload: "https://accounts.google.com/o/oauth2/v2/auth?reconnect=1",
    });
    const urlInput =
      await screen.findByLabelText<HTMLInputElement>("Google sign-in URL");
    const selectSpy = vi.spyOn(urlInput, "select");
    await user.click(urlInput);
    expect(selectSpy).toHaveBeenCalled();
    resolveConnect({
      email: "alice@gmail.com",
      name: "Alice G",
      access_token: "at",
      refresh_token: "rt",
      expiry: 1,
    });
  });

  it("creates, edits, and deletes templates", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Review templates/ }));

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
    expect(
      screen.getByRole("heading", { name: "Delete template?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
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
    expect(
      screen.getByRole("heading", { name: "Delete history entry?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Removed from history",
    );
  });

  it("validates template fields and restores default favorites", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Review templates/ }));
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

  it("adds and removes favorite people on People tab", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    await user.click(screen.getByRole("tab", { name: /^People/ }));

    await user.type(
      screen.getByLabelText("GitHub login to favorite"),
      "octocat",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(mockFetchGithubUser).toHaveBeenCalledWith("octocat");
      expect(getFavoriteUsers().some((u) => u.login === "octocat")).toBe(true);
    });
    expect(screen.getByText("The Octocat")).toBeInTheDocument();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Favorited @octocat");

    await user.click(screen.getByRole("button", { name: "Remove @octocat" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Removed @octocat");
    expect(getFavoriteUsers()).toHaveLength(0);
  });

  it("validates favorite people input and handles lookup failure", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    await user.click(screen.getByRole("tab", { name: /^People/ }));

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "Enter a valid GitHub login",
    );

    mockFetchGithubUser.mockRejectedValueOnce(new Error("404"));
    await user.type(
      screen.getByLabelText("GitHub login to favorite"),
      "missing-user",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "GitHub user @missing-user not found",
      );
    });
  });

  it("shows existing favorite people and allows removal", async () => {
    const user = userEvent.setup();
    toggleFavoriteUser({
      login: "devuser",
      name: "Dev User",
      avatarUrl: "",
      htmlUrl: "https://github.com/devuser",
    });
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    await user.click(screen.getByRole("tab", { name: /^People/ }));
    expect(screen.getByText("Dev User")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove @devuser" }));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Removed @devuser");
  });

  it("surfaces Google connect failures that are not user cancellation", async () => {
    const user = userEvent.setup();
    mockConnectGoogle.mockRejectedValueOnce(new Error("OAuth network error"));
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Google/ }));
    await user.click(screen.getByRole("button", { name: "Connect Google" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: OAuth network error",
      );
    });
    expect(vi.mocked(toast.message)).not.toHaveBeenCalled();
  });

  it("shows connection overview cards on General", () => {
    renderSettings();
    expect(
      screen.getByRole("button", { name: /GitHub.*Token configured/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Jira.*No key/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Google.*Not connected/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /AI provider/i }),
    ).toBeInTheDocument();
  });

  it("validates Jira fields and surfaces save/disconnect failures", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Jira/ }));
    expect(screen.getByRole("button", { name: "Save key" })).toBeDisabled();

    await user.type(
      screen.getByLabelText("Jira site URL"),
      "https://acme.atlassian.net",
    );
    await user.type(screen.getByLabelText("Jira email"), "alice@example.com");
    await user.type(screen.getByLabelText("Jira API token"), "bad-token");
    mockValidateJira.mockRejectedValueOnce(new Error("invalid token"));
    await user.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: invalid token",
      );
    });

    await user.click(screen.getByRole("button", { name: "Save key" }));
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    mockDeleteJira.mockRejectedValueOnce(new Error("delete failed"));
    await user.click(screen.getByRole("button", { name: "Remove key" }));
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Error: delete failed",
      );
    });
  });

  it("closes delete dialogs via onOpenChange (Escape)", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Review templates/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Template name"), "EscTemp");
    await user.type(screen.getByPlaceholderText("Comment body"), "Body");
    await user.click(screen.getByRole("button", { name: "Save template" }));
    await user.click(screen.getByRole("button", { name: "Delete EscTemp" }));
    expect(
      screen.getByRole("heading", { name: "Delete template?" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Delete template?" }),
      ).not.toBeInTheDocument();
    });
    expect(getTemplates().some((t) => t.name === "EscTemp")).toBe(true);

    saveReviewLocally({
      repo: "acme/app",
      prNumber: 77,
      prTitle: "Escape history",
      prUrl: "https://github.com/acme/app/pull/77",
      branch: "feat/e",
      event: "COMMENT",
      summary: "keep",
      body: "keep",
      comments: [],
    });
    await user.click(screen.getByRole("tab", { name: /History/ }));
    await user.click(
      screen.getByRole("button", { name: "Delete saved review" }),
    );
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Delete history entry?" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Escape history")).toBeInTheDocument();
  });

  it("shows favorite tab counts and switches repos/people subtabs", async () => {
    const user = userEvent.setup();
    toggleFavorite("acme/alpha");
    toggleFavoriteBranch({
      repo: "acme/app",
      branch: "feat/y",
      prNumber: 5,
      title: "Branch PR",
      url: "https://github.com/acme/app/pull/5",
    });
    toggleFavoriteUser({
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "",
      htmlUrl: "https://github.com/octocat",
    });

    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(
      screen.getByRole("tab", { name: /Repos \(2\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /People \(1\)/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^People/ }));
    expect(screen.getByText("The Octocat")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Repos \(2\)/ }));
    expect(screen.getByText("acme/alpha")).toBeInTheDocument();
  });

  it("shows empty favorite branches and cancels delete dialogs", async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole("tab", { name: /Favorites/ }));
    expect(screen.getByText("No favorite branches yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Review templates/ }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.type(screen.getByPlaceholderText("Template name"), "Temp");
    await user.type(screen.getByPlaceholderText("Comment body"), "Body");
    await user.click(screen.getByRole("button", { name: "Save template" }));
    await user.click(screen.getByRole("button", { name: "Delete Temp" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Delete template?" }),
    ).not.toBeInTheDocument();

    saveReviewLocally({
      repo: "acme/app",
      prNumber: 55,
      prTitle: "Cancel history",
      prUrl: "https://github.com/acme/app/pull/55",
      branch: "feat/c",
      event: "COMMENT",
      summary: "x",
      body: "x",
      comments: [],
    });
    await user.click(screen.getByRole("tab", { name: /History/ }));
    await user.click(
      screen.getByRole("button", { name: "Delete saved review" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Delete history entry?" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Cancel history")).toBeInTheDocument();
  });
});
