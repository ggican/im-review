import type { PrLists, PrTab, PullRequest } from "./types";
import { EMPTY_PR_LISTS } from "./types";

const STORAGE_KEY = "im-review:pr-lists-v1";

type Listener = () => void;
const listeners = new Set<Listener>();

type PersistedPrCache = {
  lists: PrLists;
  /** Last successful network update (any tab). */
  updatedAt: string | null;
  /** Per-tab last successful fetch. */
  tabUpdatedAt: Partial<Record<PrTab, string>>;
};

function emptyPersisted(): PersistedPrCache {
  return {
    lists: { ...EMPTY_PR_LISTS },
    updatedAt: null,
    tabUpdatedAt: {},
  };
}

function isPrLists(v: unknown): v is PrLists {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.all) &&
    Array.isArray(o.favorites) &&
    Array.isArray(o.assigned) &&
    Array.isArray(o.review) &&
    Array.isArray(o.mine)
  );
}

function readPersisted(): PersistedPrCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPersisted();
    const parsed = JSON.parse(raw) as Partial<PersistedPrCache>;
    if (!isPrLists(parsed.lists)) return emptyPersisted();
    return {
      lists: {
        all: parsed.lists.all ?? [],
        favorites: parsed.lists.favorites ?? [],
        assigned: parsed.lists.assigned ?? [],
        review: parsed.lists.review ?? [],
        mine: parsed.lists.mine ?? [],
      },
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      tabUpdatedAt:
        parsed.tabUpdatedAt && typeof parsed.tabUpdatedAt === "object"
          ? parsed.tabUpdatedAt
          : {},
    };
  } catch {
    return emptyPersisted();
  }
}

function writePersisted(next: PersistedPrCache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — keep memory cache only
  }
}

let persisted = readPersisted();
let cache: PrLists = persisted.lists;

function emit() {
  for (const l of listeners) l();
}

export function subscribePrCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPrCache(): PrLists {
  return cache;
}

export function getPrCacheUpdatedAt(): Date | null {
  return persisted.updatedAt ? new Date(persisted.updatedAt) : null;
}

export function getPrTabUpdatedAt(tab: PrTab): Date | null {
  const iso = persisted.tabUpdatedAt[tab];
  return iso ? new Date(iso) : null;
}

export function setPrCache(lists: PrLists): void {
  cache = lists;
  persisted = {
    ...persisted,
    lists,
  };
  writePersisted(persisted);
  emit();
}

/** Persist one tab after a successful network fetch. */
export function setPrCacheTab(tab: PrTab, items: PullRequest[]): void {
  const now = new Date().toISOString();
  const lists = { ...cache, [tab]: items };
  cache = lists;
  persisted = {
    lists,
    updatedAt: now,
    tabUpdatedAt: { ...persisted.tabUpdatedAt, [tab]: now },
  };
  writePersisted(persisted);
  emit();
}

export function flattenPrCache(lists: PrLists = cache): PullRequest[] {
  const seen = new Set<string>();
  const out: PullRequest[] = [];
  for (const pr of [
    ...lists.all,
    ...lists.favorites,
    ...lists.review,
    ...lists.assigned,
    ...lists.mine,
  ]) {
    const key = `${pr.repo}#${pr.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pr);
  }
  return out;
}

/** Re-read localStorage into memory (also used by tests). */
export function reloadPrCacheFromStorage(): PrLists {
  persisted = readPersisted();
  cache = persisted.lists;
  emit();
  return cache;
}

/** Test helper — clear memory + storage. */
export function clearPrCacheForTests(): void {
  persisted = emptyPersisted();
  cache = persisted.lists;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}
