export type AiBrowserSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

export type AiProvider = "OPENAI" | "ANTHROPIC" | "GEMINI";

export const AI_PROVIDERS: Array<{
  value: AiProvider;
  label: string;
  apiKeyUrl: string;
  apiKeyPlaceholder: string;
  models: Array<{ value: string; label: string }>;
}> = [
  {
    value: "OPENAI",
    label: "OpenAI",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    apiKeyPlaceholder: "sk-...",
    models: [
      { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    ],
  },
  {
    value: "ANTHROPIC",
    label: "Claude",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    apiKeyPlaceholder: "sk-ant-...",
    models: [
      { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { value: "claude-opus-5", label: "Claude Opus 5" },
      { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { value: "claude-fable-5", label: "Claude Fable 5" },
    ],
  },
  {
    value: "GEMINI",
    label: "Gemini",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    apiKeyPlaceholder: "AIza...",
    models: [
      { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
      { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    ],
  },
];

export const DEFAULT_AI_PROVIDER: AiProvider = "OPENAI";

export function getAiProvider(provider: AiProvider) {
  return AI_PROVIDERS.find((item) => item.value === provider) ?? AI_PROVIDERS[0];
}

export function getDefaultAiModel(provider: AiProvider) {
  return getAiProvider(provider).models[0].value;
}

export function aiSettingsStorageKey(organizationId: string) {
  return `org_schedule_ai_connection:${organizationId}`;
}

export function readAiBrowserSettings(organizationId: string): AiBrowserSettings {
  const fallback = {
    provider: DEFAULT_AI_PROVIDER,
    apiKey: "",
    model: getDefaultAiModel(DEFAULT_AI_PROVIDER),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(aiSettingsStorageKey(organizationId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AiBrowserSettings>;
    const provider = AI_PROVIDERS.some((item) => item.value === parsed.provider)
      ? parsed.provider as AiProvider
      : DEFAULT_AI_PROVIDER;
    const availableModels = getAiProvider(provider).models;
    return {
      provider,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && availableModels.some((item) => item.value === parsed.model)
        ? parsed.model
        : getDefaultAiModel(provider),
    };
  } catch {
    return fallback;
  }
}
