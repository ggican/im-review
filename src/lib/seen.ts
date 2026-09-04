import type { PullRequest } from "@/features/pr/types";

const LAST_SEEN_KEY = "im-review:last-seen-at";

try {
  if (localStorage.getItem(LAST_SEEN_KEY) == null) {
    const legacy = localStorage.getItem("pr-helper:last-seen-at");
    if (legacy != null) {
      localStorage.setItem(LAST_SEEN_KEY, legacy);
      localStorage.removeItem("pr-helper:last-seen-at");
    }
  }
} catch {
  // ignore
}
type Listener = () => void;
const listeners = new Set<Listener>();

let lastSeenCache: string | null = (() => {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
})();

function emit() {
  for (const l of listeners) l();
}

export function subscribeLastSeen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastSeenAt(): string | null {
  return lastSeenCache;
}

/** Snapshot for useSyncExternalStore. */
export function getLastSeenSnapshot(): string | null {
  return lastSeenCache;
}

/**
 * First dashboard visit seeds "now" so the whole backlog isn't marked new.
 * Subsequent visits compare PR updatedAt against this watermark.
 */
export function ensureLastSeenSeeded(): string {
  if (lastSeenCache) return lastSeenCache;
  return markAllSeen();
}

export function markAllSeen(at = new Date().toISOString()): string {
  lastSeenCache = at;
  try {
    localStorage.setItem(LAST_SEEN_KEY, at);
  } catch {
    // ignore quota / private mode
  }
  emit();
  return at;
}

export function isPrNew(
  pr: Pick<PullRequest, "updatedAt" | "createdAt">,
  lastSeen: string | null = lastSeenCache,
): boolean {
  if (!lastSeen) return false;
  const seenMs = Date.parse(lastSeen);
  if (Number.isNaN(seenMs)) return false;
  const updatedMs = Date.parse(pr.updatedAt || pr.createdAt);
  if (Number.isNaN(updatedMs)) return false;
  return updatedMs > seenMs;
}

export function countNewPrs(
  prs: Array<Pick<PullRequest, "updatedAt" | "createdAt">>,
  lastSeen: string | null = lastSeenCache,
): number {
  return prs.filter((pr) => isPrNew(pr, lastSeen)).length;
}
