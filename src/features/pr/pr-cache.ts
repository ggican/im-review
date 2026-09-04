import type { PrLists, PullRequest } from "./types";

const EMPTY: PrLists = { assigned: [], review: [], mine: [] };

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: PrLists = EMPTY;

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

export function setPrCache(lists: PrLists): void {
  cache = lists;
  emit();
}

export function flattenPrCache(lists: PrLists = cache): PullRequest[] {
  const seen = new Set<string>();
  const out: PullRequest[] = [];
  for (const pr of [...lists.review, ...lists.assigned, ...lists.mine]) {
    const key = `${pr.repo}#${pr.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pr);
  }
  return out;
}
