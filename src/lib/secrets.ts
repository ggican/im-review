import type { AiProviderId } from "@/features/ai-review/providers";
import { AI_PROVIDERS } from "@/features/ai-review/providers";

const GITHUB_KEY = "im-review:github-pat";
const AI_PREFIX = "im-review:ai-key:";

/** One-time move from older key namespaces. */
function migrateKey(from: string, to: string): void {
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

migrateKey("im-tech:github-pat", GITHUB_KEY);
migrateKey("pr-helper:github-pat", GITHUB_KEY);
for (const p of AI_PROVIDERS) {
  migrateKey(`im-tech:ai-key:${p.id}`, `${AI_PREFIX}${p.id}`);
}
function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    return value?.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  localStorage.setItem(key, value.trim());
}

function remove(key: string) {
  localStorage.removeItem(key);
}

export function getGithubToken(): string | null {
  return read(GITHUB_KEY);
}

export function setGithubToken(token: string) {
  write(GITHUB_KEY, token);
}

export function clearGithubToken() {
  remove(GITHUB_KEY);
}

export function hasGithubToken(): boolean {
  return Boolean(getGithubToken());
}

export function getAiKey(provider: AiProviderId): string | null {
  return read(`${AI_PREFIX}${provider}`);
}

export function setAiKey(provider: AiProviderId, key: string) {
  write(`${AI_PREFIX}${provider}`, key);
}

export function clearAiKey(provider: AiProviderId) {
  remove(`${AI_PREFIX}${provider}`);
}

export function hasAiKeyLocal(provider: AiProviderId): boolean {
  return Boolean(getAiKey(provider));
}

export function listAiKeysLocal(): Partial<Record<AiProviderId, string>> {
  const out: Partial<Record<AiProviderId, string>> = {};
  for (const provider of AI_PROVIDERS) {
    const key = getAiKey(provider.id);
    if (key) out[provider.id] = key;
  }
  return out;
}

/** Payload for Rust in-memory hydrate (no keychain). */
export function secretsHydratePayload(): {
  githubToken: string | null;
  aiKeys: Record<string, string>;
} {
  const aiKeys: Record<string, string> = {};
  for (const [id, key] of Object.entries(listAiKeysLocal())) {
    if (key) aiKeys[id] = key;
  }
  return {
    githubToken: getGithubToken(),
    aiKeys,
  };
}
