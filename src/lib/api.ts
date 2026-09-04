import { invoke } from "@tauri-apps/api/core";

import type { AiProviderId } from "@/features/ai-review/providers";
import { AI_PROVIDERS } from "@/features/ai-review/providers";
import {
  clearAiKey,
  clearGithubToken,
  getAiKey,
  getGithubToken,
  hasAiKeyLocal,
  hasGithubToken,
  listAiKeysLocal,
  secretsHydratePayload,
  setAiKey,
  setGithubToken,
} from "@/lib/secrets";

export type GithubUser = {
  login: string;
  name: string | null;
  avatar_url: string;
};

export type AiProviderStatus = {
  id: string;
  has_key: boolean;
};

/** Push localStorage secrets into Rust memory for GitHub/AI HTTP calls. */
export async function hydrateRuntimeSecrets(): Promise<void> {
  const payload = secretsHydratePayload();
  await invoke<void>("hydrate_runtime_secrets", {
    githubToken: payload.githubToken,
    aiKeys: payload.aiKeys,
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
