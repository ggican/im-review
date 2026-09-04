import type { AiProviderId } from "@/features/ai-review/providers";
import {
  DEFAULT_AI_PROVIDER,
  isAiProviderId,
} from "@/features/ai-review/providers";
import type { FavoriteBranch, SavedReview } from "@/features/pr/types";

export type ThemeMode = "system" | "light" | "dark";

export type AppSettings = {
  refreshIntervalMin: number; // 0 = disabled
  theme: ThemeMode;
  favoritesOnly: boolean;
  /** Active AI backend for draft reviews. */
  aiProvider: AiProviderId;
};

export type CommentTemplate = {
  id: string;
  name: string;
  body: string;
};

const SETTINGS_KEY = "im-review:settings";
const TEMPLATES_KEY = "im-review:templates";
const FAVORITES_KEY = "im-review:favorites";
const FAVORITES_SEED_KEY = "im-review:favorites-seed-version";
/** Bump to re-merge DEFAULT_FAVORITES into existing installs. */
const FAVORITES_SEED_VERSION = "2";
const FAVORITE_BRANCHES_KEY = "im-review:favorite-branches";
const SAVED_REVIEWS_KEY = "im-review:saved-reviews";

function migrateStorageKey(from: string, to: string): void {
  try {
    if (localStorage.getItem(to) != null) return;
    const legacy = localStorage.getItem(from);
    if (legacy == null) return;
    localStorage.setItem(to, legacy);
    localStorage.removeItem(from);
  } catch {
    // ignore
  }
}

for (const [from, to] of [
  ["pr-helper:settings", SETTINGS_KEY],
  ["pr-helper:templates", TEMPLATES_KEY],
  ["pr-helper:favorites", FAVORITES_KEY],
  ["pr-helper:favorites-seed-version", FAVORITES_SEED_KEY],
  ["pr-helper:favorite-branches", FAVORITE_BRANCHES_KEY],
  ["pr-helper:saved-reviews", SAVED_REVIEWS_KEY],
] as const) {
  migrateStorageKey(from, to);
}const MAX_SAVED_REVIEWS = 50;

export const DEFAULT_SETTINGS: AppSettings = {
  refreshIntervalMin: 5,
  theme: "system",
  favoritesOnly: true,
  aiProvider: DEFAULT_AI_PROVIDER,
};

/** Seeded once when favorites storage is empty. Format: owner/name. */
export const DEFAULT_FAVORITES: string[] = [
  "tiket/TIX-TTD-B2C-WEB",
  "tiket/TIX-HOTEL-MM-DASH-NEXT-FE",
  "tiket/TIX-EVENTS-V2-ADMIN",
  "tiket/TIX-MM-DASHBOARD-FE",
  "tiket/TIX-HOTEL-SUPPLIER-DASHBOARD-NEXT-FE",
  "tiket/TIX-HOTEL-ADMIN-CARE-NEXT-FE",
  "tiket/TIX-CHAT-PLATFORM-LIB-FE",
  "tiket/TIX-TTD-INTERNAL-FE",
  "tiket/TIX-HOTEL-NEXT-FE",
];

const DEFAULT_TEMPLATES: CommentTemplate[] = [
  {
    id: "lgtm",
    name: "LGTM",
    body: "LGTM, thanks!",
  },
  {
    id: "rebase",
    name: "Please rebase",
    body: "Please rebase onto the latest main. Thanks!",
  },
  {
    id: "nits",
    name: "Minor nits",
    body: "Looks good overall — a few minor nits in the review comments.",
  },
];

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Cached snapshots — useSyncExternalStore requires referential stability
// when the underlying data has not changed.
let settingsCache: AppSettings = {
  ...DEFAULT_SETTINGS,
  ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}),
};
if (!isAiProviderId(settingsCache.aiProvider)) {
  settingsCache.aiProvider = DEFAULT_AI_PROVIDER;
}

function loadTemplates(): CommentTemplate[] {
  const stored = readJson<CommentTemplate[] | null>(TEMPLATES_KEY, null);
  if (!stored) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES));
    return DEFAULT_TEMPLATES;
  }
  return stored;
}

let templatesCache: CommentTemplate[] = loadTemplates();

function loadFavorites(): string[] {
  let current: string[] = [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (raw != null) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        current = parsed.filter((r): r is string => typeof r === "string");
      }
    }
  } catch {
    current = [];
  }

  const seedVersion = localStorage.getItem(FAVORITES_SEED_KEY);
  if (seedVersion !== FAVORITES_SEED_VERSION || current.length === 0) {
    current = [...new Set([...DEFAULT_FAVORITES, ...current])].sort();
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(current));
    localStorage.setItem(FAVORITES_SEED_KEY, FAVORITES_SEED_VERSION);
  }
  return current;
}

let favoritesCache: string[] = loadFavorites();

function loadFavoriteBranches(): FavoriteBranch[] {
  const raw = readJson<unknown>(FAVORITE_BRANCHES_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is FavoriteBranch =>
      b != null &&
      typeof b === "object" &&
      typeof (b as FavoriteBranch).id === "string" &&
      typeof (b as FavoriteBranch).repo === "string" &&
      typeof (b as FavoriteBranch).branch === "string",
  );
}

let favoriteBranchesCache: FavoriteBranch[] = loadFavoriteBranches();

function loadSavedReviews(): SavedReview[] {
  const raw = readJson<unknown>(SAVED_REVIEWS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is SavedReview =>
      r != null &&
      typeof r === "object" &&
      typeof (r as SavedReview).id === "string" &&
      typeof (r as SavedReview).repo === "string",
  );
}

let savedReviewsCache: SavedReview[] = loadSavedReviews();

export function favoriteBranchId(repo: string, branch: string): string {
  return `${repo}::${branch}`;
}

export function getFavoriteBranches(): FavoriteBranch[] {
  return favoriteBranchesCache;
}

export function isFavoriteBranch(repo: string, branch: string): boolean {
  const id = favoriteBranchId(repo, branch);
  return favoriteBranchesCache.some((b) => b.id === id);
}

export function saveFavoriteBranches(next: FavoriteBranch[]): void {
  favoriteBranchesCache = [...next].sort((a, b) =>
    a.favoritedAt < b.favoritedAt ? 1 : -1,
  );
  localStorage.setItem(
    FAVORITE_BRANCHES_KEY,
    JSON.stringify(favoriteBranchesCache),
  );
  emit();
}

export function toggleFavoriteBranch(input: {
  repo: string;
  branch: string;
  prNumber: number;
  title: string;
  url: string;
}): FavoriteBranch[] {
  const id = favoriteBranchId(input.repo, input.branch);
  const exists = favoriteBranchesCache.some((b) => b.id === id);
  const next = exists
    ? favoriteBranchesCache.filter((b) => b.id !== id)
    : [
        {
          id,
          repo: input.repo,
          branch: input.branch,
          prNumber: input.prNumber,
          title: input.title,
          url: input.url,
          favoritedAt: new Date().toISOString(),
        },
        ...favoriteBranchesCache,
      ];
  saveFavoriteBranches(next);
  return next;
}

export function removeFavoriteBranch(id: string): FavoriteBranch[] {
  const next = favoriteBranchesCache.filter((b) => b.id !== id);
  saveFavoriteBranches(next);
  return next;
}

export function getSavedReviews(): SavedReview[] {
  return savedReviewsCache;
}

export function saveReviewLocally(
  entry: Omit<SavedReview, "id" | "submittedAt"> & {
    id?: string;
    submittedAt?: string;
  },
): SavedReview[] {
  const saved: SavedReview = {
    id: entry.id ?? `rev_${Date.now().toString(36)}`,
    repo: entry.repo,
    prNumber: entry.prNumber,
    prTitle: entry.prTitle,
    prUrl: entry.prUrl,
    branch: entry.branch,
    event: entry.event,
    summary: entry.summary,
    body: entry.body,
    comments: entry.comments,
    submittedAt: entry.submittedAt ?? new Date().toISOString(),
  };
  savedReviewsCache = [saved, ...savedReviewsCache].slice(0, MAX_SAVED_REVIEWS);
  localStorage.setItem(SAVED_REVIEWS_KEY, JSON.stringify(savedReviewsCache));
  emit();
  return savedReviewsCache;
}

export function deleteSavedReview(id: string): SavedReview[] {
  savedReviewsCache = savedReviewsCache.filter((r) => r.id !== id);
  localStorage.setItem(SAVED_REVIEWS_KEY, JSON.stringify(savedReviewsCache));
  emit();
  return savedReviewsCache;
}

export function getSettings(): AppSettings {
  return settingsCache;
}

export function saveSettings(next: AppSettings): void {
  settingsCache = { ...DEFAULT_SETTINGS, ...next };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
  applyTheme(settingsCache.theme);
  emit();
}

export function getTemplates(): CommentTemplate[] {
  return templatesCache;
}

export function saveTemplates(templates: CommentTemplate[]): void {
  templatesCache = templates;
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  emit();
}

export function upsertTemplate(template: CommentTemplate): CommentTemplate[] {
  const list = getTemplates();
  const i = list.findIndex((t) => t.id === template.id);
  const next =
    i >= 0
      ? list.map((t, idx) => (idx === i ? template : t))
      : [...list, template];
  saveTemplates(next);
  return next;
}

export function deleteTemplate(id: string): CommentTemplate[] {
  const next = getTemplates().filter((t) => t.id !== id);
  saveTemplates(next);
  return next;
}

export function getFavorites(): string[] {
  return favoritesCache;
}

export function saveFavorites(repos: string[]): void {
  favoritesCache = [...new Set(repos)].sort();
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesCache));
  emit();
}

export function isFavorite(fullName: string): boolean {
  return favoritesCache.includes(fullName);
}

export function toggleFavorite(fullName: string): string[] {
  const next = isFavorite(fullName)
    ? favoritesCache.filter((r) => r !== fullName)
    : [...favoritesCache, fullName];
  saveFavorites(next);
  return next;
}

export function removeFavorite(fullName: string): string[] {
  const next = favoritesCache.filter((r) => r !== fullName);
  saveFavorites(next);
  return next;
}

export function restoreDefaultFavorites(): string[] {
  const next = [...new Set([...DEFAULT_FAVORITES, ...favoritesCache])].sort();
  localStorage.setItem(FAVORITES_SEED_KEY, FAVORITES_SEED_VERSION);
  saveFavorites(next);
  return next;
}

export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && preferDark);
  root.classList.toggle("dark", dark);
}

export function newTemplateId(): string {
  return `tpl_${Date.now().toString(36)}`;
}
