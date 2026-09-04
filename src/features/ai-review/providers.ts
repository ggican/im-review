export type AiProviderId =
  "cursor" | "openai" | "codex" | "anthropic" | "gemini";

export type AiProviderMeta = {
  id: AiProviderId;
  label: string;
  placeholder: string;
  docsUrl: string;
  hint: string;
};

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: "cursor",
    label: "Cursor",
    placeholder: "cursor_... or key from Integrations",
    docsUrl: "https://cursor.com/dashboard/integrations",
    hint: "Local Cursor SDK review from GitHub patches.",
  },
  {
    id: "openai",
    label: "OpenAI",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    hint: "Chat Completions (e.g. gpt-4.1-mini).",
  },
  {
    id: "codex",
    label: "OpenAI Codex",
    placeholder: "sk-... (OpenAI key)",
    docsUrl: "https://platform.openai.com/api-keys",
    hint: "OpenAI-compatible path tuned for Codex/GPT coding models.",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/",
    hint: "Anthropic Messages API.",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
    hint: "Gemini generateContent API.",
  },
];

export const DEFAULT_AI_PROVIDER: AiProviderId = "cursor";

export function isAiProviderId(value: string): value is AiProviderId {
  return AI_PROVIDERS.some((p) => p.id === value);
}
