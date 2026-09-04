import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_PROVIDERS,
  type AiProviderId,
} from "@/features/ai-review/providers";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  type AppSettings,
  type CommentTemplate,
  deleteSavedReview,
  deleteTemplate,
  getSettings,
  newTemplateId,
  removeFavorite,
  removeFavoriteBranch,
  restoreDefaultFavorites,
  saveSettings,
  type ThemeMode,
  upsertTemplate,
} from "@/lib/settings";
import { relativeTime } from "@/lib/time";
import {
  useFavoriteBranches,
  useFavorites,
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

type SettingsTab = "general" | "ai" | "templates" | "favorites" | "history";

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "ai", label: "AI" },
  { id: "templates", label: "Templates" },
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
    <section
      className={cn(
        "space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950",
        className,
      )}
    >
      {children}
    </section>
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
        <h2 className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function ScrollList({ children }: { children: ReactNode }) {
  return (
    <ul className="max-h-[min(28rem,55vh)] divide-y divide-neutral-200 overflow-y-auto rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {children}
    </ul>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const templates = useTemplates();
  const favorites = useFavorites();
  const favoriteBranches = useFavoriteBranches();
  const savedReviews = useSavedReviews();
  const [tab, setTab] = useState<SettingsTab>("general");
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

  const focusedProvider =
    AI_PROVIDERS.find((p) => p.id === aiFocus) ?? AI_PROVIDERS.find(() => true);
  if (!focusedProvider) {
    return null;
  }
  const focusedHasKey = Boolean(providerStatus[focusedProvider.id]);
  const focusedBusy = aiBusy === focusedProvider.id;

  const tabLabels = TABS.map((item) => {
    if (item.id === "templates" && templates.length > 0) {
      return { ...item, label: `Templates (${templates.length})` };
    }
    if (item.id === "favorites") {
      const n = favorites.length + favoriteBranches.length;
      return n > 0 ? { ...item, label: `Favorites (${n})` } : item;
    }
    if (item.id === "history" && savedReviews.length > 0) {
      return { ...item, label: `History (${savedReviews.length})` };
    }
    return item;
  });

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        title="Settings"
        subtitle="Preferences, AI keys, and local shortcuts"
        backTo="/"
      />

      <div
        role="tablist"
        aria-label="Settings sections"
        className="inline-flex flex-wrap rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {tabLabels.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "general" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel>
            <PanelIntro
              title="Auto refresh"
              description="How often to reload PR lists in the background."
            />
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={
                    draft.refreshIntervalMin === opt.value
                      ? "default"
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
            <PanelIntro title="Theme" description="Appearance for this app." />
            <div className="flex flex-wrap gap-2">
              {(["system", "light", "dark"] as ThemeMode[]).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={draft.theme === mode ? "default" : "outline"}
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
              title="Account"
              description={`Current refresh: ${
                getSettings().refreshIntervalMin || "off"
              } · GitHub PAT is stored locally in this app.`}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void reconnect()}
            >
              Reconnect GitHub PAT
            </Button>
          </Panel>
        </div>
      ) : null}

      {tab === "ai" ? (
        <Panel>
          <PanelIntro
            title="AI providers"
            description="Keys stay in local app storage. Reviews always draft first — nothing auto-posts to GitHub."
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-neutral-500">
              Active provider
            </p>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  size="sm"
                  variant={
                    draft.aiProvider === provider.id ? "default" : "outline"
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
            <p className="mb-1.5 text-xs font-medium text-neutral-500">
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
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700",
                    )}
                  >
                    {provider.label}
                    <span
                      className={cn(
                        "ml-1.5",
                        hasKey
                          ? selected
                            ? "text-emerald-300 dark:text-emerald-700"
                            : "text-emerald-600 dark:text-emerald-400"
                          : selected
                            ? "text-neutral-400 dark:text-neutral-500"
                            : "text-neutral-400",
                      )}
                    >
                      {hasKey ? "●" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">
                    {focusedProvider.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
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
                {focusedHasKey ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Key saved
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">No key</span>
                )}
              </div>

              {focusedHasKey ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={focusedBusy}
                  onClick={() => void removeAi(focusedProvider.id)}
                >
                  Remove key
                </Button>
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
                  />
                  <Button
                    type="button"
                    size="sm"
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
            <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
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
                <Button type="button" size="sm" onClick={saveTemplate}>
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
              <li className="px-4 py-8 text-center text-sm text-neutral-500">
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
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                      {t.body}
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${t.name}`}
                    onClick={() => {
                      deleteTemplate(t.id);
                      toast.success("Template deleted");
                    }}
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
                <li className="px-3 py-4 text-sm text-neutral-500">
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
                      <Button asChild type="button" size="sm" variant="outline">
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
                <li className="px-3 py-4 text-sm text-neutral-500">
                  No favorite branches yet.
                </li>
              ) : (
                favoriteBranches.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-start justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.title}</p>
                      <p className="mt-0.5 font-mono text-xs text-neutral-500">
                        {b.repo} · {b.branch} · #{b.prNumber}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button asChild type="button" size="sm" variant="outline">
                        <a href={b.url} target="_blank" rel="noreferrer">
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
      ) : null}

      {tab === "history" ? (
        <Panel>
          <PanelIntro
            title="Submitted review history"
            description={`Local copies after you submit from the app (last ${savedReviews.length}/50).`}
          />
          <ScrollList>
            {savedReviews.length === 0 ? (
              <li className="px-3 py-4 text-sm text-neutral-500">
                No submitted reviews saved yet.
              </li>
            ) : (
              savedReviews.map((r) => (
                <li key={r.id} className="space-y-2 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.prTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
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
                      onClick={() => {
                        deleteSavedReview(r.id);
                        toast.success("Removed from history");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="line-clamp-3 text-xs text-neutral-600 dark:text-neutral-400">
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
    </PageShell>
  );
}
