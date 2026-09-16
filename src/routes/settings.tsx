import { listen } from "@tauri-apps/api/event";
import {
  Bot,
  Calendar,
  GitPullRequest,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_PROVIDERS,
  type AiProviderId,
} from "@/features/ai-review/providers";
import { fetchGithubUser } from "@/features/people/api";
import { normalizeGithubLogin } from "@/features/people/login";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import {
  type AppSettings,
  type CommentTemplate,
  deleteSavedReview,
  deleteTemplate,
  getFavoriteUsers,
  getSettings,
  MAX_FAVORITE_USERS,
  newTemplateId,
  removeFavorite,
  removeFavoriteBranch,
  removeFavoriteUser,
  restoreDefaultFavorites,
  saveGooglePublic,
  saveJiraPublic,
  saveSettings,
  type ThemeMode,
  toggleFavoriteUser,
  upsertTemplate,
} from "@/lib/settings";
import { relativeTime } from "@/lib/time";
import {
  useFavoriteBranches,
  useFavorites,
  useFavoriteUsers,
  useGooglePublic,
  useJiraPublic,
  useSavedReviews,
  useSettings,
  useTemplates,
} from "@/lib/use-settings";

const INTERVALS = [
  { value: 0, label: "Off" },
  { value: 1, label: "1 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
];

type SettingsTab =
  | "general"
  | "ai"
  | "github"
  | "jira"
  | "google"
  | "templates"
  | "favorites"
  | "history";

type FavoritesSubTab = "repos" | "people";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI providers" },
  { id: "github", label: "GitHub" },
  { id: "jira", label: "Jira" },
  { id: "google", label: "Google" },
  { id: "templates", label: "Review templates" },
  { id: "favorites", label: "Favorites" },
  { id: "history", label: "History" },
];

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="default" className={cn("space-y-4", className)}>
      {children}
    </Card>
  );
}

function PanelIntro({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-title-md text-on-surface">{title}</h2>
        {description ? (
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function ScrollList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-border border-border max-h-[min(28rem,55vh)] divide-y overflow-y-auto rounded-lg border">
      {children}
    </ul>
  );
}

function StatusBadge({
  connected,
  connectedLabel = "Connected",
  disconnectedLabel = "Disconnected",
}: {
  connected: boolean;
  connectedLabel?: string;
  disconnectedLabel?: string;
}) {
  return (
    <Badge variant={connected ? "success" : "outline"}>
      {connected ? connectedLabel : disconnectedLabel}
    </Badge>
  );
}

function ConnectionCard({
  title,
  description,
  connected,
  detail,
  badge,
  accentClass,
  icon,
  onOpen,
}: {
  title: string;
  description: string;
  connected: boolean;
  detail: string;
  badge?: ReactNode;
  accentClass: string;
  icon: ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "hover:bg-surface-container-low/60 rounded-xl border p-3 text-left transition-colors",
        accentClass,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-on-surface-variant mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-md text-on-surface font-medium">
              {title}
            </span>
            {badge ?? <StatusBadge connected={connected} />}
          </div>
          <p className="text-body-sm text-on-surface-variant mt-0.5 truncate">
            {detail}
          </p>
          <p className="text-body-sm text-on-surface-variant mt-1">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const templates = useTemplates();
  const favorites = useFavorites();
  const favoriteBranches = useFavoriteBranches();
  const favoriteUsers = useFavoriteUsers();
  const jiraPublic = useJiraPublic();
  const googlePublic = useGooglePublic();
  const savedReviews = useSavedReviews();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [favoritesSubTab, setFavoritesSubTab] =
    useState<FavoritesSubTab>("repos");
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [editing, setEditing] = useState<CommentTemplate | null>(null);
  const [providerStatus, setProviderStatus] = useState<
    Partial<Record<AiProviderId, boolean>>
  >({});
  const [aiDraftKeys, setAiDraftKeys] = useState<
    Partial<Record<AiProviderId, string>>
  >({});
  const [aiBusy, setAiBusy] = useState<AiProviderId | null>(null);
  const [aiFocus, setAiFocus] = useState<AiProviderId>(
    settings.aiProvider ?? "cursor",
  );
  const [jiraHost, setJiraHost] = useState(jiraPublic?.host ?? "");
  const [jiraEmail, setJiraEmail] = useState(jiraPublic?.email ?? "");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraBusy, setJiraBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleAuthUrl, setGoogleAuthUrl] = useState<string | null>(null);
  const [personLogin, setPersonLogin] = useState("");
  const [personBusy, setPersonBusy] = useState(false);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] =
    useState<CommentTemplate | null>(null);
  const [pendingDeleteReviewId, setPendingDeleteReviewId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<string>("google-oauth-url", (event) => {
      if (typeof event.payload === "string" && event.payload) {
        setGoogleAuthUrl(event.payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    document.title = "Settings · IM Review";
  }, []);

  useEffect(() => {
    void api
      .listAiProviderStatus()
      .then((rows) => {
        const next: Partial<Record<AiProviderId, boolean>> = {};
        for (const row of rows) {
          next[row.id as AiProviderId] = row.has_key;
        }
        setProviderStatus(next);
      })
      .catch(() => setProviderStatus({}));
  }, []);

  function patch(partial: Partial<AppSettings>) {
    const next = { ...draft, ...partial };
    setDraft(next);
    saveSettings(next);
  }

  function startNew() {
    setEditing({ id: newTemplateId(), name: "", body: "" });
  }

  function saveTemplate() {
    if (!editing) return;
    if (!editing.name.trim() || !editing.body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    upsertTemplate({
      ...editing,
      name: editing.name.trim(),
      body: editing.body.trim(),
    });
    setEditing(null);
    toast.success("Template saved");
  }

  async function reconnect() {
    await api.deleteToken();
    toast.success("Token cleared — reconnect with a new PAT");
    navigate("/onboarding", { replace: true });
  }

  async function saveAi(provider: AiProviderId) {
    const key = (aiDraftKeys[provider] ?? "").trim();
    if (!key) return;
    setAiBusy(provider);
    try {
      await api.validateAiKey(provider, key);
      await api.saveAiKey(provider, key);
      setProviderStatus((prev) => ({ ...prev, [provider]: true }));
      setAiDraftKeys((prev) => ({ ...prev, [provider]: "" }));
      toast.success(`${provider} API key saved`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setAiBusy(null);
    }
  }

  async function removeAi(provider: AiProviderId) {
    setAiBusy(provider);
    try {
      await api.deleteAiKey(provider);
      setProviderStatus((prev) => ({ ...prev, [provider]: false }));
      toast.success(`${provider} API key removed`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setAiBusy(null);
    }
  }

  async function connectJira() {
    const host = jiraHost.trim();
    const email = jiraEmail.trim();
    const token = jiraToken.trim();
    if (!host || !email || !token) {
      toast.error("Site URL, email, and API token are required");
      return;
    }
    setJiraBusy(true);
    try {
      const me = await api.validateJira({ host, email, token });
      await api.saveJira({ host, email, token });
      saveJiraPublic({
        host: me.host,
        email: me.email,
        displayName: me.display_name,
        accountId: me.account_id,
        avatarUrl: me.avatar_url,
      });
      setJiraToken("");
      toast.success("Jira API key saved");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setJiraBusy(false);
    }
  }

  async function disconnectJira() {
    setJiraBusy(true);
    try {
      await api.deleteJira();
      saveJiraPublic(null);
      toast.success("Jira API key removed");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setJiraBusy(false);
    }
  }

  async function connectGoogle() {
    if (!isGoogleOAuthConfigured()) {
      toast.error("Google is not configured in this build");
      return;
    }
    setGoogleBusy(true);
    setGoogleAuthUrl(null);
    try {
      const account = await api.connectGoogle();
      saveGooglePublic({ email: account.email, name: account.name });
      toast.success("Google connected (Calendar & Gmail)");
    } catch (err) {
      const message = String(err);
      if (/sign-in cancelled/i.test(message)) {
        toast.message("Google sign-in cancelled");
      } else {
        toast.error(message);
      }
    } finally {
      setGoogleBusy(false);
      setGoogleAuthUrl(null);
    }
  }

  async function cancelGoogleConnect() {
    try {
      await api.cancelGoogleConnect();
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function copyGoogleAuthUrl() {
    if (!googleAuthUrl) return;
    try {
      await navigator.clipboard.writeText(googleAuthUrl);
      toast.success("Sign-in URL copied");
    } catch {
      toast.error("Could not copy URL");
    }
  }

  async function disconnectGoogle() {
    setGoogleBusy(true);
    try {
      await api.deleteGoogle();
      saveGooglePublic(null);
      toast.success("Google disconnected");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function addFavoritePerson() {
    const login = normalizeGithubLogin(personLogin);
    if (!login) {
      toast.error("Enter a valid GitHub login");
      return;
    }
    setPersonBusy(true);
    try {
      const user = await fetchGithubUser(login);
      if (
        getFavoriteUsers().length >= MAX_FAVORITE_USERS &&
        !getFavoriteUsers().some(
          (u) => u.login.toLowerCase() === user.login.toLowerCase(),
        )
      ) {
        toast.error(`Favorite people limit is ${MAX_FAVORITE_USERS}`);
        return;
      }
      toggleFavoriteUser(user);
      setPersonLogin("");
      toast.success(`Favorited @${user.login}`);
    } catch {
      toast.error(`GitHub user @${login} not found`);
    } finally {
      setPersonBusy(false);
    }
  }

  const focusedProvider =
    AI_PROVIDERS.find((p) => p.id === aiFocus) ?? AI_PROVIDERS.find(() => true);
  if (!focusedProvider) {
    return null;
  }
  const focusedHasKey = Boolean(providerStatus[focusedProvider.id]);
  const focusedBusy = aiBusy === focusedProvider.id;
  const anyAiKey = AI_PROVIDERS.some((p) => providerStatus[p.id]);
  const activeProviderLabel =
    AI_PROVIDERS.find((p) => p.id === draft.aiProvider)?.label ??
    draft.aiProvider;

  const tabLabels = TABS.map((item) => {
    if (item.id === "templates" && templates.length > 0) {
      return { ...item, label: `Review templates (${templates.length})` };
    }
    if (item.id === "favorites") {
      const n =
        favorites.length + favoriteBranches.length + favoriteUsers.length;
      return n > 0 ? { ...item, label: `Favorites (${n})` } : item;
    }
    if (item.id === "history" && savedReviews.length > 0) {
      return { ...item, label: `History (${savedReviews.length})` };
    }
    return item;
  });

  return (
    <PageShell width="full" className="gap-5">
      <PageHeader
        title="Settings"
        subtitle="Connections, preferences, and local data"
      />

      <TabsList aria-label="Settings sections" className="h-auto flex-wrap">
        {tabLabels.map((item) => (
          <TabsTrigger
            key={item.id}
            id={`settings-tab-${item.id}`}
            aria-controls="settings-tab-panel"
            active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsPanel
        id="settings-tab-panel"
        aria-labelledby={`settings-tab-${tab}`}
      >
        {tab === "general" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ConnectionCard
                title="GitHub"
                description="PAT stored in local keychain. Never shown in the UI."
                connected
                detail="Token configured · reconnect to rotate"
                accentClass="border-stream-github-border/80 bg-stream-github/30"
                icon={<GitPullRequest className="h-4 w-4" aria-hidden />}
                onOpen={() => setTab("github")}
              />
              <ConnectionCard
                title="Jira"
                description="API token stored locally for work-item lists."
                connected={Boolean(jiraPublic)}
                detail={
                  jiraPublic
                    ? `${jiraPublic.displayName} · ${jiraPublic.host.replace(/^https:\/\//, "")}`
                    : "Not connected"
                }
                badge={
                  <StatusBadge
                    connected={Boolean(jiraPublic)}
                    connectedLabel="Key saved"
                    disconnectedLabel="No key"
                  />
                }
                accentClass="border-stream-jira-border/80 bg-stream-jira/30"
                icon={<Ticket className="h-4 w-4" aria-hidden />}
                onOpen={() => setTab("jira")}
              />
              <ConnectionCard
                title="Google"
                description="One OAuth for Calendar and Gmail."
                connected={Boolean(googlePublic)}
                detail={
                  googlePublic
                    ? googlePublic.name || googlePublic.email
                    : "Not connected"
                }
                badge={
                  <StatusBadge
                    connected={Boolean(googlePublic)}
                    connectedLabel="Connected"
                    disconnectedLabel="Not connected"
                  />
                }
                accentClass="border-stream-gmail-border/80 bg-stream-gmail/30"
                icon={<Calendar className="h-4 w-4" aria-hidden />}
                onOpen={() => setTab("google")}
              />
              <ConnectionCard
                title="AI provider"
                description="Keys stay in local app storage."
                connected={anyAiKey}
                detail={`${activeProviderLabel}${anyAiKey ? " · key configured" : " · no key"}`}
                badge={
                  <StatusBadge
                    connected={anyAiKey}
                    connectedLabel="Key saved"
                    disconnectedLabel="No key"
                  />
                }
                accentClass="border-stream-ai-border/80 bg-stream-ai/30"
                icon={<Bot className="h-4 w-4" aria-hidden />}
                onOpen={() => setTab("ai")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Panel>
                <PanelIntro
                  title="Auto refresh"
                  description="How often to reload PR lists while the app is open or running in the menu bar (closing the window hides to tray; Quit exits)."
                />
                <div className="flex flex-wrap gap-2">
                  {INTERVALS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={
                        draft.refreshIntervalMin === opt.value
                          ? "accent"
                          : "outline"
                      }
                      onClick={() => patch({ refreshIntervalMin: opt.value })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelIntro
                  title="Theme"
                  description="Appearance for this app."
                />
                <div className="flex flex-wrap gap-2">
                  {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={draft.theme === mode ? "accent" : "outline"}
                      onClick={() => patch({ theme: mode })}
                      className="capitalize"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
              </Panel>

              <Panel className="sm:col-span-2">
                <PanelIntro
                  title="People tab"
                  description="Optional dashboard tab listing open PRs from all favorite authors."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={draft.showFavoritePeople ? "accent" : "outline"}
                    onClick={() => patch({ showFavoritePeople: true })}
                  >
                    Show People tab
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!draft.showFavoritePeople ? "accent" : "outline"}
                    onClick={() => patch({ showFavoritePeople: false })}
                  >
                    Hide
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "ai" ? (
          <Panel>
            <PanelIntro
              title="AI providers"
              description="Keys stay in local app storage. Reviews always draft first — nothing auto-posts to GitHub."
            />

            <div>
              <p className="text-label-sm text-on-surface-variant mb-1.5">
                Active provider
              </p>
              <div className="flex flex-wrap gap-2">
                {AI_PROVIDERS.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    size="sm"
                    variant={
                      draft.aiProvider === provider.id ? "accent" : "outline"
                    }
                    onClick={() => {
                      patch({ aiProvider: provider.id });
                      setAiFocus(provider.id);
                    }}
                  >
                    {provider.label}
                    {providerStatus[provider.id] ? " · key" : ""}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-label-sm text-on-surface-variant mb-1.5">
                Configure key
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {AI_PROVIDERS.map((provider) => {
                  const selected = aiFocus === provider.id;
                  const hasKey = Boolean(providerStatus[provider.id]);
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setAiFocus(provider.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        selected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-border text-on-surface-variant hover:border-outline-variant",
                      )}
                    >
                      {provider.label}
                      <span
                        className={cn(
                          "ml-1.5",
                          hasKey
                            ? selected
                              ? "text-primary-container"
                              : "text-success"
                            : selected
                              ? "text-on-primary/60"
                              : "text-on-surface-variant",
                        )}
                      >
                        {hasKey ? "●" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-stream-ai-border/80 bg-stream-ai/30 space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-body-md text-on-surface font-medium">
                      {focusedProvider.label}
                    </h3>
                    <p className="text-body-sm text-on-surface-variant mt-0.5">
                      {focusedProvider.hint}{" "}
                      <a
                        href={focusedProvider.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Get key
                      </a>
                    </p>
                  </div>
                  <StatusBadge
                    connected={focusedHasKey}
                    connectedLabel="Key saved"
                    disconnectedLabel="No key"
                  />
                </div>

                {focusedHasKey ? (
                  <div className="space-y-2">
                    <p className="text-on-surface-variant font-mono text-xs">
                      API key · •••••••• (masked)
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={focusedBusy}
                      onClick={() => void removeAi(focusedProvider.id)}
                    >
                      Remove key
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="password"
                      placeholder={focusedProvider.placeholder}
                      value={aiDraftKeys[focusedProvider.id] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAiDraftKeys((prev) => ({
                          ...prev,
                          [focusedProvider.id]: value,
                        }));
                      }}
                      disabled={focusedBusy}
                      aria-label={`${focusedProvider.label} API key`}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={
                        focusedBusy ||
                        !(aiDraftKeys[focusedProvider.id] ?? "").trim()
                      }
                      onClick={() => void saveAi(focusedProvider.id)}
                    >
                      Save key
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        ) : null}

        {tab === "github" ? (
          <Panel>
            <PanelIntro
              title="GitHub"
              description="Personal access token for PR lists and review submit. Stored in the OS keychain — never shown here."
            />
            <div className="border-stream-github-border/80 bg-stream-github/30 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-body-md text-on-surface font-medium">
                    GitHub PAT
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Current refresh: {getSettings().refreshIntervalMin || "off"}{" "}
                    · token stays local to this app.
                  </p>
                </div>
                <StatusBadge connected connectedLabel="Token configured" />
              </div>
              <p className="text-on-surface-variant font-mono text-xs">
                Credential · •••••••• (masked)
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void reconnect()}
              >
                Reconnect GitHub PAT
              </Button>
            </div>
          </Panel>
        ) : null}

        {tab === "jira" ? (
          <Panel>
            <PanelIntro
              title="Jira Cloud"
              description="Same as AI keys: paste the token, save locally, remove anytime. Used only to list your work items."
            />
            <div className="border-stream-jira-border/80 bg-stream-jira/30 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-body-md text-on-surface font-medium">
                    Atlassian API token
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Site URL + email + token from Atlassian.{" "}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Get token
                    </a>
                  </p>
                </div>
                <StatusBadge
                  connected={Boolean(jiraPublic)}
                  connectedLabel="Key saved"
                  disconnectedLabel="No key"
                />
              </div>

              {jiraPublic ? (
                <>
                  <p className="text-body-md text-on-surface truncate">
                    {jiraPublic.displayName}
                    <span className="text-body-sm text-on-surface-variant block truncate">
                      {jiraPublic.email} ·{" "}
                      {jiraPublic.host.replace(/^https:\/\//, "")}
                    </span>
                  </p>
                  <p className="text-on-surface-variant font-mono text-xs">
                    API token · •••••••• (masked)
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={jiraBusy}
                    onClick={() => void disconnectJira()}
                  >
                    Remove key
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="https://your-site.atlassian.net"
                    value={jiraHost}
                    onChange={(e) => setJiraHost(e.target.value)}
                    aria-label="Jira site URL"
                    disabled={jiraBusy}
                  />
                  <Input
                    placeholder="Atlassian email"
                    value={jiraEmail}
                    onChange={(e) => setJiraEmail(e.target.value)}
                    aria-label="Jira email"
                    disabled={jiraBusy}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="password"
                      placeholder="Atlassian API token"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      aria-label="Jira API token"
                      disabled={jiraBusy}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={
                        jiraBusy ||
                        !jiraHost.trim() ||
                        !jiraEmail.trim() ||
                        !jiraToken.trim()
                      }
                      onClick={() => void connectJira()}
                    >
                      Save key
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        ) : null}

        {tab === "google" ? (
          <Panel>
            <PanelIntro
              title="Google (Calendar & Gmail)"
              description="One Connect for Calendar and Gmail. IM Review stores a refresh token locally. Enable Calendar API and Gmail API in Google Cloud Console."
            />
            <div className="border-stream-gmail-border/80 bg-stream-gmail/30 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-body-md text-on-surface font-medium">
                    Google account
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    Calendar and Gmail share this sign-in. No Client ID needed —
                    the app handles OAuth for you.
                  </p>
                </div>
                <StatusBadge
                  connected={Boolean(googlePublic)}
                  connectedLabel="Connected"
                  disconnectedLabel="Not connected"
                />
              </div>

              {googlePublic ? (
                <>
                  <p className="text-body-md text-on-surface truncate">
                    {googlePublic.name || googlePublic.email}
                    <span className="text-body-sm text-on-surface-variant block truncate">
                      {googlePublic.email}
                    </span>
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    Calendar and Gmail use the same account. If Gmail fails
                    after an app update, use Connect again to grant new scopes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={googleBusy}
                      onClick={() => void connectGoogle()}
                    >
                      {googleBusy ? "Waiting for Google…" : "Reconnect Google"}
                    </Button>
                    {googleBusy ? (
                      <>
                        {googleAuthUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyGoogleAuthUrl()}
                          >
                            Copy URL
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelGoogleConnect()}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={googleBusy}
                      onClick={() => void disconnectGoogle()}
                    >
                      Disconnect
                    </Button>
                  </div>
                  {googleBusy && googleAuthUrl ? (
                    <div className="space-y-1">
                      <p className="text-body-sm text-on-surface-variant">
                        Browser should open. If not, copy this URL and paste it
                        in a browser:
                      </p>
                      <Input
                        readOnly
                        value={googleAuthUrl}
                        className="font-mono text-xs"
                        aria-label="Google sign-in URL"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      disabled={googleBusy || !isGoogleOAuthConfigured()}
                      onClick={() => void connectGoogle()}
                    >
                      {googleBusy ? "Waiting for Google…" : "Connect Google"}
                    </Button>
                    {googleBusy ? (
                      <>
                        {googleAuthUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void copyGoogleAuthUrl()}
                          >
                            Copy URL
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void cancelGoogleConnect()}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {googleBusy && googleAuthUrl ? (
                    <div className="space-y-1">
                      <p className="text-body-sm text-on-surface-variant">
                        Browser should open. If not, copy this URL and paste it
                        in a browser:
                      </p>
                      <Input
                        readOnly
                        value={googleAuthUrl}
                        className="font-mono text-xs"
                        aria-label="Google sign-in URL"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {!isGoogleOAuthConfigured() && !googlePublic ? (
                <p className="border-warning/30 bg-warning-container text-body-sm text-on-warning-container rounded-lg border px-3 py-2">
                  This build has no Google OAuth client. Set{" "}
                  <code className="bg-surface-container-high rounded px-1 font-mono text-xs">
                    VITE_GOOGLE_OAUTH_CLIENT_ID
                  </code>{" "}
                  and{" "}
                  <code className="bg-surface-container-high rounded px-1 font-mono text-xs">
                    VITE_GOOGLE_OAUTH_CLIENT_SECRET
                  </code>{" "}
                  then rebuild.
                </p>
              ) : null}
            </div>
          </Panel>
        ) : null}

        {tab === "templates" ? (
          <Panel>
            <PanelIntro
              title="Comment templates"
              description="Quick-fill review comments from the PR drawer."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={startNew}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              }
            />

            {editing ? (
              <div className="border-border bg-surface-container-low/40 space-y-2 rounded-lg border p-4">
                <Input
                  placeholder="Template name"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
                <Textarea
                  placeholder="Comment body"
                  rows={4}
                  value={editing.body}
                  onChange={(e) =>
                    setEditing({ ...editing, body: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="accent"
                    onClick={saveTemplate}
                  >
                    Save template
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <ScrollList>
              {templates.length === 0 ? (
                <li className="text-body-md text-on-surface-variant px-4 py-8 text-center">
                  No templates yet.
                </li>
              ) : (
                templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setEditing(t)}
                    >
                      <div className="text-body-md text-on-surface font-medium">
                        {t.name}
                      </div>
                      <div className="text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
                        {t.body}
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => setPendingDeleteTemplate(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))
              )}
            </ScrollList>
          </Panel>
        ) : null}

        {tab === "favorites" ? (
          <div className="space-y-4">
            <TabsList aria-label="Favorite categories" className="h-auto">
              <TabsTrigger
                id="favorites-subtab-repos"
                aria-controls="favorites-subtab-panel"
                active={favoritesSubTab === "repos"}
                onClick={() => setFavoritesSubTab("repos")}
              >
                {favorites.length + favoriteBranches.length > 0
                  ? `Repos (${favorites.length + favoriteBranches.length})`
                  : "Repos"}
              </TabsTrigger>
              <TabsTrigger
                id="favorites-subtab-people"
                aria-controls="favorites-subtab-panel"
                active={favoritesSubTab === "people"}
                onClick={() => setFavoritesSubTab("people")}
              >
                {favoriteUsers.length > 0
                  ? `People (${favoriteUsers.length})`
                  : "People"}
              </TabsTrigger>
            </TabsList>

            <TabsPanel
              id="favorites-subtab-panel"
              aria-labelledby={`favorites-subtab-${favoritesSubTab}`}
              className="space-y-4"
            >
              {favoritesSubTab === "repos" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel>
                    <PanelIntro
                      title="Favorite repos"
                      description="Used by the Favorites filter on the dashboard."
                      action={
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            restoreDefaultFavorites();
                            toast.success("Default favorite repos restored");
                          }}
                        >
                          Restore defaults
                        </Button>
                      }
                    />
                    <ScrollList>
                      {favorites.length === 0 ? (
                        <li className="text-body-sm text-on-surface-variant px-3 py-4">
                          No favorite repos. Click Restore defaults.
                        </li>
                      ) : (
                        favorites.map((fullName) => (
                          <li
                            key={fullName}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                          >
                            <span className="min-w-0 truncate font-mono text-xs">
                              {fullName}
                            </span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                asChild
                                type="button"
                                size="sm"
                                variant="outline"
                              >
                                <a
                                  href={`https://github.com/${fullName}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove ${fullName}`}
                                onClick={() => {
                                  removeFavorite(fullName);
                                  toast.success(`Removed ${fullName}`);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))
                      )}
                    </ScrollList>
                  </Panel>

                  <Panel>
                    <PanelIntro
                      title="Favorite branches"
                      description="Star a PR to pin its head branch here."
                    />
                    <ScrollList>
                      {favoriteBranches.length === 0 ? (
                        <li className="text-body-sm text-on-surface-variant px-3 py-4">
                          No favorite branches yet.
                        </li>
                      ) : (
                        favoriteBranches.map((b) => (
                          <li
                            key={b.id}
                            className="flex items-start justify-between gap-3 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-body-md text-on-surface truncate font-medium">
                                {b.title}
                              </p>
                              <p className="text-on-surface-variant mt-0.5 font-mono text-xs">
                                {b.repo} · {b.branch} · #{b.prNumber}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                asChild
                                type="button"
                                size="sm"
                                variant="outline"
                              >
                                <a
                                  href={b.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Remove favorite branch"
                                onClick={() => {
                                  removeFavoriteBranch(b.id);
                                  toast.success("Removed favorite branch");
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))
                      )}
                    </ScrollList>
                  </Panel>
                </div>
              ) : (
                <Panel>
                  <PanelIntro
                    title="Favorite people"
                    description="Pin GitHub authors. Used by the Author filter on the dashboard."
                  />
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addFavoritePerson();
                    }}
                  >
                    <Input
                      placeholder="GitHub login"
                      value={personLogin}
                      onChange={(e) => setPersonLogin(e.target.value)}
                      aria-label="GitHub login to favorite"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="accent"
                      disabled={personBusy}
                    >
                      Add
                    </Button>
                  </form>
                  <ScrollList>
                    {favoriteUsers.length === 0 ? (
                      <li className="text-body-sm text-on-surface-variant px-3 py-4">
                        No favorite people yet.
                      </li>
                    ) : (
                      favoriteUsers.map((user) => (
                        <li
                          key={user.login}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <span className="min-w-0">
                            <span className="text-body-md text-on-surface block truncate font-medium">
                              {user.name ?? user.login}
                            </span>
                            <span className="text-on-surface-variant block truncate font-mono text-xs">
                              @{user.login}
                            </span>
                          </span>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              asChild
                              type="button"
                              size="sm"
                              variant="outline"
                            >
                              <a
                                href={user.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove @${user.login}`}
                              onClick={() => {
                                removeFavoriteUser(user.login);
                                toast.success(`Removed @${user.login}`);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))
                    )}
                  </ScrollList>
                </Panel>
              )}
            </TabsPanel>
          </div>
        ) : null}

        {tab === "history" ? (
          <Panel>
            <PanelIntro
              title="Submitted review history"
              description={`Local copies after you submit from the app (last ${savedReviews.length}/50).`}
            />
            <ScrollList>
              {savedReviews.length === 0 ? (
                <li className="text-body-sm text-on-surface-variant px-3 py-4">
                  No submitted reviews saved yet.
                </li>
              ) : (
                savedReviews.map((r) => (
                  <li key={r.id} className="space-y-2 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-md text-on-surface truncate font-medium">
                          {r.prTitle}
                        </p>
                        <p className="text-body-sm text-on-surface-variant mt-0.5">
                          <span className="font-mono">
                            {r.repo}#{r.prNumber}
                          </span>
                          {r.branch ? (
                            <>
                              {" "}
                              · <span className="font-mono">{r.branch}</span>
                            </>
                          ) : null}{" "}
                          · {r.event} · {relativeTime(r.submittedAt)} ·{" "}
                          {r.comments.length} inline
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Delete saved review"
                        onClick={() => setPendingDeleteReviewId(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-body-sm text-on-surface-variant line-clamp-3">
                      {r.summary}
                    </p>
                    <Button asChild type="button" size="sm" variant="outline">
                      <a href={r.prUrl} target="_blank" rel="noreferrer">
                        Open PR
                      </a>
                    </Button>
                  </li>
                ))
              )}
            </ScrollList>
          </Panel>
        ) : null}
      </TabsPanel>

      <Dialog
        open={pendingDeleteTemplate != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTemplate(null);
        }}
      >
        <DialogContent side="center" className="max-w-sm p-0">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              {pendingDeleteTemplate
                ? `Remove “${pendingDeleteTemplate.name}” from local templates.`
                : "Remove this template."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 py-4">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingDeleteTemplate(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteTemplate) return;
                deleteTemplate(pendingDeleteTemplate.id);
                setPendingDeleteTemplate(null);
                toast.success("Template deleted");
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteReviewId != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteReviewId(null);
        }}
      >
        <DialogContent side="center" className="max-w-sm p-0">
          <DialogHeader>
            <DialogTitle>Delete history entry?</DialogTitle>
            <DialogDescription>
              Remove this local submitted-review copy. GitHub is unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 py-4">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingDeleteReviewId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteReviewId) return;
                deleteSavedReview(pendingDeleteReviewId);
                setPendingDeleteReviewId(null);
                toast.success("Removed from history");
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
