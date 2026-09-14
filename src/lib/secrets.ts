import type { AiProviderId } from "@/features/ai-review/providers";
import { AI_PROVIDERS } from "@/features/ai-review/providers";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } from "@/lib/google-oauth";

const GITHUB_KEY = "im-review:github-pat";
const AI_PREFIX = "im-review:ai-key:";
const JIRA_HOST_KEY = "im-review:jira-host";
const JIRA_EMAIL_KEY = "im-review:jira-email";
const JIRA_TOKEN_KEY = "im-review:jira-token";
const GOOGLE_CLIENT_ID_KEY = "im-review:google-client-id";
const GOOGLE_CLIENT_SECRET_KEY = "im-review:google-client-secret";
const GOOGLE_ACCESS_TOKEN_KEY = "im-review:google-access-token";
const GOOGLE_REFRESH_TOKEN_KEY = "im-review:google-refresh-token";
const GOOGLE_EXPIRY_KEY = "im-review:google-expiry";

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

export function getJiraHost(): string | null {
  return read(JIRA_HOST_KEY);
}

export function getJiraEmail(): string | null {
  return read(JIRA_EMAIL_KEY);
}

export function getJiraToken(): string | null {
  return read(JIRA_TOKEN_KEY);
}

export function hasJiraCreds(): boolean {
  return Boolean(getJiraHost() && getJiraEmail() && getJiraToken());
}

export function setJiraCreds(input: {
  host: string;
  email: string;
  token: string;
}): void {
  write(JIRA_HOST_KEY, input.host);
  write(JIRA_EMAIL_KEY, input.email);
  write(JIRA_TOKEN_KEY, input.token);
}

export function clearJiraCreds(): void {
  remove(JIRA_HOST_KEY);
  remove(JIRA_EMAIL_KEY);
  remove(JIRA_TOKEN_KEY);
}

export function getGoogleClientId(): string | null {
  return read(GOOGLE_CLIENT_ID_KEY);
}

export function getGoogleClientSecret(): string | null {
  return read(GOOGLE_CLIENT_SECRET_KEY);
}

export function getGoogleAccessToken(): string | null {
  return read(GOOGLE_ACCESS_TOKEN_KEY);
}

export function getGoogleRefreshToken(): string | null {
  return read(GOOGLE_REFRESH_TOKEN_KEY);
}

export function getGoogleExpiry(): number | null {
  const raw = read(GOOGLE_EXPIRY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function hasGoogleCreds(): boolean {
  return Boolean(getGoogleRefreshToken());
}

/** Persist app-owned client id/secret so hydrate stays consistent after reconnect. */
export function ensureGoogleOAuthClient(): void {
  if (GOOGLE_OAUTH_CLIENT_ID) write(GOOGLE_CLIENT_ID_KEY, GOOGLE_OAUTH_CLIENT_ID);
  if (GOOGLE_OAUTH_CLIENT_SECRET) {
    write(GOOGLE_CLIENT_SECRET_KEY, GOOGLE_OAUTH_CLIENT_SECRET);
  }
}

export function setGoogleTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiry: number;
}): void {
  write(GOOGLE_ACCESS_TOKEN_KEY, input.accessToken);
  write(GOOGLE_REFRESH_TOKEN_KEY, input.refreshToken);
  write(GOOGLE_EXPIRY_KEY, String(input.expiry));
}

export function clearGoogleTokens(): void {
  remove(GOOGLE_ACCESS_TOKEN_KEY);
  remove(GOOGLE_REFRESH_TOKEN_KEY);
  remove(GOOGLE_EXPIRY_KEY);
}

export function clearGoogleCreds(): void {
  remove(GOOGLE_CLIENT_ID_KEY);
  remove(GOOGLE_CLIENT_SECRET_KEY);
  clearGoogleTokens();
}

/** Payload for Rust in-memory hydrate (no keychain). */
export function secretsHydratePayload(): {
  githubToken: string | null;
  aiKeys: Record<string, string>;
  jiraHost: string | null;
  jiraEmail: string | null;
  jiraToken: string | null;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleAccessToken: string | null;
  googleRefreshToken: string | null;
  googleExpiry: number | null;
} {
  const aiKeys: Record<string, string> = {};
  for (const [id, key] of Object.entries(listAiKeysLocal())) {
    if (key) aiKeys[id] = key;
  }
  return {
    githubToken: getGithubToken(),
    aiKeys,
    jiraHost: getJiraHost(),
    jiraEmail: getJiraEmail(),
    jiraToken: getJiraToken(),
    googleClientId: GOOGLE_OAUTH_CLIENT_ID || getGoogleClientId(),
    googleClientSecret: GOOGLE_OAUTH_CLIENT_SECRET || getGoogleClientSecret(),
    googleAccessToken: getGoogleAccessToken(),
    googleRefreshToken: getGoogleRefreshToken(),
    googleExpiry: getGoogleExpiry(),
  };
}
