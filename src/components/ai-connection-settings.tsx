"use client";

import { useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  type AiProvider,
  aiSettingsStorageKey,
  getAiProvider,
  getDefaultAiModel,
  readAiBrowserSettings,
} from "@/lib/ai-browser-settings";

const subscribe = () => () => {};

export function AiConnectionSettings({ organizationId }: { organizationId: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!isClient) return <section className="card min-h-64 animate-pulse bg-slate-50 p-6" aria-label="AI 연결 설정 불러오는 중" />;
  return <AiConnectionSettingsForm organizationId={organizationId} />;
}

function AiConnectionSettingsForm({ organizationId }: { organizationId: string }) {
  const saved = readAiBrowserSettings(organizationId);
  const [provider, setProvider] = useState<AiProvider>(saved.provider);
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [model, setModel] = useState(saved.model);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(saved.apiKey ? "이 브라우저에 API 키가 저장되어 있습니다." : "API 키가 저장되지 않았습니다.");
  const providerConfig = getAiProvider(provider);

  function changeProvider(nextProvider: AiProvider) {
    setProvider(nextProvider);
    setApiKey("");
    setModel(getDefaultAiModel(nextProvider));
    setShowKey(false);
    setStatus("제공사가 변경되었습니다. 해당 제공사의 API 키를 입력해 주세요.");
  }

  function save() {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      setStatus("저장할 API 키를 입력해 주세요.");
      return;
    }
    window.localStorage.setItem(
      aiSettingsStorageKey(organizationId),
      JSON.stringify({ provider, apiKey: normalizedKey, model }),
    );
    setApiKey(normalizedKey);
    setStatus(`${providerConfig.label} 연결 설정이 저장되었습니다.`);
  }

  function clear() {
    window.localStorage.removeItem(aiSettingsStorageKey(organizationId));
    setProvider(DEFAULT_AI_PROVIDER);
    setApiKey("");
    setModel(getDefaultAiModel(DEFAULT_AI_PROVIDER));
    setShowKey(false);
    setStatus("이 브라우저에서 AI 연결 설정을 삭제했습니다.");
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-3">
        <KeyRound className="text-[var(--brand)]" />
        <div>
          <h2 className="font-extrabold">AI 연결</h2>
          <p className="muted text-sm">API 키와 모델을 직접 설정합니다.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="label">AI 제공사
          <select className="field" value={provider} onChange={(event) => changeProvider(event.target.value as AiProvider)}>
            {AI_PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="label">{providerConfig.label} API 키
          <span className="relative block">
            <input
              className="field pr-12 font-mono"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={providerConfig.apiKeyPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500" type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </span>
        </label>
        <label className="label">모델
          <select className="field font-mono" value={model} onChange={(event) => setModel(event.target.value)}>
            {providerConfig.models.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}
          </select>
          <span className="muted text-xs">선택한 제공사의 보고서 생성 모델을 사용합니다.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="button" onClick={save}>연결 저장</button>
          <button className="btn btn-danger" type="button" onClick={clear}><Trash2 size={16} /> 삭제</button>
        </div>
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" role="status">{status}</p>
        <p className="muted text-xs leading-5">API 키는 조직 데이터나 서버 DB에 저장되지 않고 현재 브라우저의 로컬 저장소에만 보관됩니다. 보고서 생성 요청 때만 서버를 거쳐 선택한 AI 제공사로 전송됩니다.</p>
        <a className="w-fit text-sm font-bold text-[var(--brand)] underline underline-offset-4" href={providerConfig.apiKeyUrl} target="_blank" rel="noreferrer">{providerConfig.label} API 키 발급 페이지 ↗</a>
      </div>
    </section>
  );
}
