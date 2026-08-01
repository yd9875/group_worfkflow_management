export type AiBrowserSettings = {
  apiKey: string;
  model: string;
};

export const DEFAULT_AI_MODEL = "gpt-5.6-terra";

export function aiSettingsStorageKey(organizationId: string) {
  return `org_schedule_ai_connection:${organizationId}`;
}

export function readAiBrowserSettings(organizationId: string): AiBrowserSettings {
  if (typeof window === "undefined") return { apiKey: "", model: DEFAULT_AI_MODEL };
  try {
    const raw = window.localStorage.getItem(aiSettingsStorageKey(organizationId));
    if (!raw) return { apiKey: "", model: DEFAULT_AI_MODEL };
    const parsed = JSON.parse(raw) as Partial<AiBrowserSettings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : DEFAULT_AI_MODEL,
    };
  } catch {
    return { apiKey: "", model: DEFAULT_AI_MODEL };
  }
}
