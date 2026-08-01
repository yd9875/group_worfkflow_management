"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { readAiBrowserSettings } from "@/lib/ai-browser-settings";

type Status = "idle" | "loading" | "ready" | "missing" | "error";

export function AiReportGenerator({ organizationId, date, view }: {
  organizationId: string;
  date: string;
  view: "day" | "week" | "month";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("저장된 API 키와 선택 모델로 보고서를 생성합니다.");

  async function generate() {
    const settings = readAiBrowserSettings(organizationId);
    if (!settings.apiKey) {
      setStatus("missing");
      setMessage("조직 관리에서 이 브라우저에 OpenAI API 키를 먼저 저장해 주세요.");
      return;
    }
    setStatus("loading");
    setMessage(`${settings.model} 모델로 보고서를 생성하고 있습니다.`);
    try {
      const response = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, date, view, apiKey: settings.apiKey, model: settings.model }),
      });
      const payload = await response.json() as { report?: string; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "AI 보고서를 생성하지 못했습니다.");
      setReport(payload.report);
      setStatus("ready");
      setMessage("AI 보고서 생성이 완료되었습니다.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "AI 보고서를 생성하지 못했습니다.");
    }
  }

  return (
    <section className="card mt-6 overflow-hidden border-[var(--brand)]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--brand-soft)] px-6 py-4">
        <div><h2 className="flex items-center gap-2 font-extrabold"><Sparkles size={17} /> AI 생성 보고서</h2><p className="mt-1 text-sm text-slate-600" role="status">{message}</p></div>
        {(status === "ready" || status === "error") && <button className="btn btn-secondary no-print" type="button" onClick={() => void generate()}><RefreshCw size={16} /> 다시 생성</button>}
      </div>
      {status === "idle" && <div className="p-8 text-center"><Sparkles className="mx-auto text-[var(--brand)]" size={30} /><p className="mt-3 font-bold">AI 보고서 생성 준비</p><p className="muted mt-1 text-sm">생성 시 사용자의 OpenAI API 사용량이 발생할 수 있습니다.</p><button className="btn btn-primary mt-4" type="button" onClick={() => void generate()}><Sparkles size={16} /> AI 보고서 생성</button></div>}
      {status === "loading" && <div className="grid min-h-48 place-items-center p-8 text-center"><div><LoaderCircle className="mx-auto animate-spin text-[var(--brand)]" size={28} /><p className="muted mt-3 text-sm">일정과 레퍼런스를 분석하고 있습니다.</p></div></div>}
      {status === "missing" && <div className="p-8 text-center"><AlertCircle className="mx-auto text-[var(--accent)]" /><p className="mt-3 font-bold">API 키가 필요합니다</p><p className="muted mt-1 text-sm">키는 서버에 저장되지 않고 현재 브라우저에만 보관됩니다.</p><Link className="btn btn-primary mt-4" href={`/org/${organizationId}/admin/settings`}>조직 관리에서 설정</Link></div>}
      {status === "error" && <div className="p-8 text-center"><AlertCircle className="mx-auto text-red-600" /><p className="mt-3 font-bold text-red-800">생성 중 문제가 발생했습니다</p><p className="muted mt-1 text-sm">{message}</p></div>}
      {status === "ready" && <div className="whitespace-pre-wrap p-6 text-sm leading-7 sm:p-8">{report}</div>}
    </section>
  );
}
