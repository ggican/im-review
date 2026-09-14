import { invoke } from "@tauri-apps/api/core";

import type { AiProviderId } from "@/features/ai-review/providers";
import { AI_PROVIDERS } from "@/features/ai-review/providers";
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  isGoogleOAuthConfigured,
} from "@/lib/google-oauth";
import {
  clearAiKey,
  clearGithubToken,
  clearGoogleCreds,
  clearJiraCreds,
  ensureGoogleOAuthClient,
  getAiKey,
  getGithubToken,
  getJiraEmail,
  getJiraHost,
  getJiraToken,
  hasAiKeyLocal,
  hasGithubToken,
  hasGoogleCreds,
  hasJiraCreds,
  listAiKeysLocal,
  secretsHydratePayload,
  setAiKey,
  setGithubToken,
  setGoogleTokens,
  setJiraCreds,
} from "@/lib/secrets";
import { getGooglePublic } from "@/lib/settings";

export type GithubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

export type JiraUser = {
  account_id: string;
  display_name: string;
  email: string;
  avatar_url: string;
  host: string;
};

export type GoogleAccount = {
  email: string;
  name: string;
  access_token: string;
  refresh_token: string;
  expiry: number;
};

export type AiProviderStatus = {
  id: string;
  has_key: boolean;
};

/** Push localStorage secrets into Rust memory for GitHub/AI HTTP calls. */
export async function hydrateRuntimeSecrets(): Promise<void> {
  const payload = secretsHydratePayload();
  const google = getGooglePublic();
  await invoke<void>("hydrate_runtime_secrets", {
    githubToken: payload.githubToken,
    aiKeys: payload.aiKeys,
    jiraHost: payload.jiraHost,
    jiraEmail: payload.jiraEmail,
    jiraToken: payload.jiraToken,
    googleClientId: payload.googleClientId,
    googleClientSecret: payload.googleClientSecret,
    googleAccessToken: payload.googleAccessToken,
    googleRefreshToken: payload.googleRefreshToken,
    googleExpiry: payload.googleExpiry,
    googleEmail: google?.email ?? null,
    googleName: google?.name ?? null,
  });
}

export const api = {
  saveToken: async (token: string) => {
    setGithubToken(token);
    await hydrateRuntimeSecrets();
  },
  hasToken: async () => hasGithubToken(),
  deleteToken: async () => {
    clearGithubToken();
    await hydrateRuntimeSecrets();
  },
  validateToken: (token?: string) =>
    invoke<GithubUser>("validate_token", {
      token: token ?? getGithubToken(),
    }),

  /** @deprecated prefer saveAiKey("cursor", key) */
  saveCursorKey: (key: string) => api.saveAiKey("cursor", key),
  /** @deprecated prefer hasAiKey("cursor") */
  hasCursorKey: () => api.hasAiKey("cursor"),
  /** @deprecated prefer deleteAiKey("cursor") */
  deleteCursorKey: () => api.deleteAiKey("cursor"),
  /** @deprecated prefer validateAiKey("cursor", key) */
  validateCursorKey: (key?: string) => api.validateAiKey("cursor", key),

  saveAiKey: async (provider: AiProviderId, key: string) => {
    setAiKey(provider, key);
    await hydrateRuntimeSecrets();
  },
  hasAiKey: async (provider: AiProviderId) => hasAiKeyLocal(provider),
  deleteAiKey: async (provider: AiProviderId) => {
    clearAiKey(provider);
    await hydrateRuntimeSecrets();
  },
  validateAiKey: (provider: AiProviderId, key?: string) =>
    invoke<unknown>("validate_ai_key", {
      provider,
      key: key ?? getAiKey(provider),
    }),
  listAiProviderStatus: async (): Promise<AiProviderStatus[]> => {
    const local = listAiKeysLocal();
    return AI_PROVIDERS.map((p) => ({
      id: p.id,
      has_key: Boolean(local[p.id]),
    }));
  },

  githubGet: <T = unknown>(path: string) => invoke<T>("github_get", { path }),
  githubRequest: <T = unknown>(method: string, path: string, body?: unknown) =>
    invoke<T>("github_request", {
      method,
      path,
      body: body ?? null,
    }),

  saveJira: async (input: { host: string; email: string; token: string }) => {
    setJiraCreds(input);
    await hydrateRuntimeSecrets();
  },
  hasJira: async () => hasJiraCreds(),
  deleteJira: async () => {
    clearJiraCreds();
    await hydrateRuntimeSecrets();
  },
  validateJira: (input?: { host: string; email: string; token: string }) =>
    invoke<JiraUser>("validate_jira", {
      host: input?.host ?? getJiraHost(),
      email: input?.email ?? getJiraEmail(),
      token: input?.token ?? getJiraToken(),
    }),
  jiraRequest: <T = unknown>(method: string, path: string, body?: unknown) =>
    invoke<T>("jira_request", {
      method,
      path,
      body: body ?? null,
    }),

  connectGoogle: async () => {
    if (!isGoogleOAuthConfigured()) {
      throw new Error(
        "Google is not configured in this build (missing OAuth client ID or secret)",
      );
    }
    ensureGoogleOAuthClient();
    const account = await invoke<GoogleAccount>("google_oauth_connect", {
      clientId: GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    });
    setGoogleTokens({
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiry: account.expiry,
    });
    await hydrateRuntimeSecrets();
    return account;
  },
  cancelGoogleConnect: () => invoke<void>("google_oauth_cancel"),
  hasGoogle: async () => hasGoogleCreds(),
  deleteGoogle: async () => {
    clearGoogleCreds();
    await hydrateRuntimeSecrets();
  },
  googleCalendarEvents: <T = unknown>() => invoke<T>("google_calendar_events"),
  googleApiRequest: <T = unknown>(
    method: string,
    urlOrPath: string,
    body?: unknown,
  ) =>
    invoke<T>("google_api_request_command", {
      method,
      urlOrPath,
      body: body ?? null,
    }),
  gmailListMessages: (args: {
    query?: string | null;
    labelIds?: string[] | null;
    pageToken?: string | null;
    maxResults?: number;
  }) =>
    invoke<unknown>("gmail_list_messages", {
      query: args.query ?? null,
      labelIds: args.labelIds ?? null,
      pageToken: args.pageToken ?? null,
      maxResults: args.maxResults ?? null,
    }),
  gmailGetMessage: (
    id: string,
    format?: string | null,
    metadataHeaders?: string[] | null,
  ) =>
    invoke<unknown>("gmail_get_message", {
      id,
      format: format ?? null,
      metadataHeaders: metadataHeaders ?? null,
    }),
  gmailModifyMessage: (
    id: string,
    args: {
      addLabelIds?: string[];
      removeLabelIds?: string[];
    },
  ) =>
    invoke<unknown>("gmail_modify_message", {
      id,
      addLabelIds: args.addLabelIds ?? null,
      removeLabelIds: args.removeLabelIds ?? null,
    }),
  gmailListLabels: () => invoke<unknown>("gmail_list_labels"),

  aiReviewPr: (args: {
    provider: AiProviderId;
    prTitle: string;
    prNumber: number;
    prUrl: string;
    patchContext: string;
  }) =>
    invoke<string>("ai_review_pr", {
      provider: args.provider,
      prTitle: args.prTitle,
      prNumber: args.prNumber,
      prUrl: args.prUrl,
      patchContext: args.patchContext,
    }),

  aiRefineReview: (args: {
    provider: AiProviderId;
    currentDraftJson: string;
    instruction: string;
  }) =>
    invoke<string>("ai_refine_review", {
      provider: args.provider,
      currentDraftJson: args.currentDraftJson,
      instruction: args.instruction,
    }),

  cursorReviewPr: (args: {
    prTitle: string;
    prNumber: number;
    prUrl: string;
    patchContext: string;
  }) =>
    api.aiReviewPr({
      provider: "cursor",
      ...args,
    }),

  cursorRefineReview: (args: {
    currentDraftJson: string;
    instruction: string;
  }) =>
    api.aiRefineReview({
      provider: "cursor",
      ...args,
    }),
};
