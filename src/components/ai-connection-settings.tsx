"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Trash2, Users } from "lucide-react";
import {
  deleteOrganizationAiConnectionAction,
  saveOrganizationAiConnectionAction,
} from "@/features/actions";
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  type AiProvider,
  getAiProvider,
  getDefaultAiModel,
} from "@/lib/ai-browser-settings";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export function AiConnectionSettings({
  organizationId,
  initialProvider,
  initialModel,
  hasApiKey,
}: {
  organizationId: string;
  initialProvider?: string | null;
  initialModel?: string | null;
  hasApiKey: boolean;
}) {
  const savedProvider = AI_PROVIDERS.some((item) => item.value === initialProvider)
    ? initialProvider as AiProvider
    : DEFAULT_AI_PROVIDER;
  const savedModels = getAiProvider(savedProvider).models;
  const savedModel = initialModel && savedModels.some((item) => item.value === initialModel)
    ? initialModel
    : getDefaultAiModel(savedProvider);
  const [provider, setProvider] = useState<AiProvider>(savedProvider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(savedModel);
  const [showKey, setShowKey] = useState(false);
  const [legacyLoaded, setLegacyLoaded] = useState(false);
  const providerConfig = getAiProvider(provider);
  const providerChanged = hasApiKey && provider !== savedProvider;

  function changeProvider(nextProvider: AiProvider) {
    setProvider(nextProvider);
    setApiKey("");
    setModel(getDefaultAiModel(nextProvider));
    setShowKey(false);
  }

  useEffect(() => {
    if (hasApiKey) return;
    try {
      const raw = window.localStorage.getItem(`org_schedule_ai_connection:${organizationId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { provider?: string; apiKey?: string; model?: string };
      const legacyProvider = AI_PROVIDERS.find((item) => item.value === parsed.provider);
      if (!legacyProvider || typeof parsed.apiKey !== "string" || parsed.apiKey.trim().length < 20) return;
      const legacyApiKey = parsed.apiKey.trim();
      const legacyModel = legacyProvider.models.some((item) => item.value === parsed.model) && parsed.model
        ? parsed.model
        : getDefaultAiModel(legacyProvider.value);
      const timer = window.setTimeout(() => {
        setProvider(legacyProvider.value);
        setApiKey(legacyApiKey);
        setModel(legacyModel);
        setLegacyLoaded(true);
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // 손상된 이전 브라우저 설정은 무시하고 새 조직 공용 설정을 입력받습니다.
    }
  }, [hasApiKey, organizationId]);

  async function save(formData: FormData) {
    await saveOrganizationAiConnectionAction(formData);
    window.localStorage.removeItem(`org_schedule_ai_connection:${organizationId}`);
    setApiKey("");
    setLegacyLoaded(false);
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-3">
        <KeyRound className="text-[var(--brand)]" />
        <div>
          <h2 className="font-extrabold">AI 연결</h2>
          <p className="muted text-sm">API 키와 모델을 조직 공용 설정으로 저장합니다.</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-sm text-[var(--brand-strong)]">
        <Users className="mt-0.5 shrink-0" size={16} />
        <p>저장된 연결은 이 조직의 모든 활성 구성원이 AI 보고서를 생성할 때 공통으로 사용합니다.</p>
      </div>
      {legacyLoaded && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">이 브라우저에 저장되어 있던 기존 연결 설정을 불러왔습니다. 아래 저장 버튼을 누르면 조직 공용 설정으로 안전하게 이전됩니다.</p>}
      <form action={save} className="mt-5 grid gap-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="label">AI 제공사
          <select className="field" name="provider" value={provider} onChange={(event) => changeProvider(event.target.value as AiProvider)}>
            {AI_PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="label">{providerConfig.label} API 키
          <span className="relative block">
            <input
              className="field pr-12 font-mono"
              name="apiKey"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasApiKey && !providerChanged ? "저장된 키 유지 — 변경할 때만 입력" : providerConfig.apiKeyPlaceholder}
              required={!hasApiKey || providerChanged}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500" type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </span>
          <span className="muted text-xs">{hasApiKey && !providerChanged ? "암호화된 조직 공용 API 키가 저장되어 있습니다. 빈칸이면 기존 키를 유지합니다." : "새 제공사에 사용할 API 키를 입력해 주세요."}</span>
        </label>
        <label className="label">모델
          <select className="field font-mono" name="model" value={model} onChange={(event) => setModel(event.target.value)}>
            {providerConfig.models.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}
          </select>
          <span className="muted text-xs">선택한 제공사의 보고서 생성 모델을 조직 구성원이 함께 사용합니다.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton className="btn btn-primary" pendingLabel="저장 중…">조직 공용 연결 저장</SubmitButton>
        </div>
      </form>
      {hasApiKey && (
        <form action={deleteOrganizationAiConnectionAction} className="mt-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <ConfirmSubmitButton className="btn btn-danger" message="조직 공용 AI 연결 설정을 삭제할까요?"><Trash2 size={16} /> 연결 삭제</ConfirmSubmitButton>
        </form>
      )}
      <p className="muted mt-4 text-xs leading-5">API 키는 서버 DB에 암호화하여 저장되며 구성원의 브라우저로 전달되지 않습니다. 보고서 생성 요청 때만 서버에서 복호화해 선택한 AI 제공사로 전송합니다.</p>
      <a className="mt-3 block w-fit text-sm font-bold text-[var(--brand)] underline underline-offset-4" href={providerConfig.apiKeyUrl} target="_blank" rel="noreferrer">{providerConfig.label} API 키 발급 페이지 ↗</a>
    </section>
  );
}
