"use client";

import { useState, useSyncExternalStore } from "react";
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import {
  DEFAULT_AI_MODEL,
  aiSettingsStorageKey,
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
  const [apiKey, setApiKey] = useState(saved.apiKey);
  const [model, setModel] = useState(saved.model);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState(saved.apiKey ? "이 브라우저에 API 키가 저장되어 있습니다." : "API 키가 저장되지 않았습니다.");

  function save() {
    const normalizedKey = apiKey.trim();
    const normalizedModel = model.trim() || DEFAULT_AI_MODEL;
    if (!normalizedKey) {
      setStatus("저장할 API 키를 입력해 주세요.");
      return;
    }
    window.localStorage.setItem(
      aiSettingsStorageKey(organizationId),
      JSON.stringify({ apiKey: normalizedKey, model: normalizedModel }),
    );
    setApiKey(normalizedKey);
    setModel(normalizedModel);
    setStatus("저장되었습니다. 이제 AI 보고서를 생성할 수 있습니다.");
  }

  function clear() {
    window.localStorage.removeItem(aiSettingsStorageKey(organizationId));
    setApiKey("");
    setModel(DEFAULT_AI_MODEL);
    setShowKey(false);
    setStatus("이 브라우저에서 API 키를 삭제했습니다.");
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-3">
        <KeyRound className="text-[var(--brand)]" />
        <div>
          <h2 className="font-extrabold">AI 연결</h2>
          <p className="muted text-sm">영상기획 TOOL과 같은 방식으로 API 키와 모델을 직접 설정합니다.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        <label className="label">OpenAI API 키
          <span className="relative block">
            <input
              className="field pr-12 font-mono"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              spellCheck={false}
            />
            <button className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500" type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </span>
        </label>
        <label className="label">모델
          <input className="field font-mono" value={model} onChange={(event) => setModel(event.target.value)} list="openai-report-models" autoComplete="off" />
          <datalist id="openai-report-models"><option value="gpt-5.6-sol" /><option value="gpt-5.6-terra" /><option value="gpt-5.6-luna" /></datalist>
          <span className="muted text-xs">기본값은 품질과 비용의 균형이 좋은 gpt-5.6-terra이며, 계정에서 사용할 수 있는 다른 모델 ID도 직접 입력할 수 있습니다.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="button" onClick={save}>키 저장</button>
          <button className="btn btn-danger" type="button" onClick={clear}><Trash2 size={16} /> 삭제</button>
        </div>
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700" role="status">{status}</p>
        <p className="muted text-xs leading-5">API 키는 조직 데이터나 서버 DB에 저장되지 않고 현재 브라우저의 로컬 저장소에만 보관됩니다. 다른 브라우저나 기기에서는 다시 입력해야 하며, 보고서 생성 요청 때만 서버를 거쳐 OpenAI로 전송됩니다.</p>
        <a className="w-fit text-sm font-bold text-[var(--brand)] underline underline-offset-4" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI API 키 발급 페이지 ↗</a>
      </div>
    </section>
  );
}
