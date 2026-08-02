"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Download, FileText, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-overlay";
import { getAiProvider, readAiBrowserSettings } from "@/lib/ai-browser-settings";
import { REPORT_FORMATS, type ReportFormat } from "@/lib/report-formats";

type Status = "idle" | "loading" | "success" | "missing" | "error";

export type GeneratedReportItem = {
  id: string;
  view: string;
  referenceDate: string;
  format: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  createdByName: string | null;
};

type GeneratedReportResponse = {
  id: string;
  view: string;
  referenceDate: string;
  format: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  createdBy: { name: string } | null;
};

const viewLabel: Record<string, string> = { day: "일일", week: "주간", month: "월간" };

function fileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function createdLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AiReportGenerator({ organizationId, date, view, initialReports }: {
  organizationId: string;
  date: string;
  view: "day" | "week" | "month";
  initialReports: GeneratedReportItem[];
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("docx");
  const [reports, setReports] = useState(initialReports);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("파일 형식을 선택한 후 AI 보고서를 생성해 주세요.");

  async function generate() {
    const settings = readAiBrowserSettings(organizationId);
    if (!settings.apiKey) {
      setStatus("missing");
      setMessage("조직 관리에서 이 브라우저에 AI 제공사와 API 키를 먼저 저장해 주세요.");
      return;
    }
    setStatus("loading");
    const providerLabel = getAiProvider(settings.provider).label;
    setMessage(`${providerLabel} · ${settings.model} 모델로 ${selectedFormat.toUpperCase()} 파일을 생성하고 있습니다.`);
    try {
      const response = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          date,
          view,
          format: selectedFormat,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
        }),
      });
      const payload = await response.json() as { report?: GeneratedReportResponse; error?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error || "AI 보고서 파일을 생성하지 못했습니다.");
      const created = payload.report;
      setReports((current) => [{
        id: created.id,
        view: created.view,
        referenceDate: created.referenceDate.slice(0, 10),
        format: created.format,
        fileName: created.fileName,
        mimeType: created.mimeType,
        size: created.size,
        createdAt: created.createdAt,
        createdByName: created.createdBy?.name ?? null,
      }, ...current]);
      setStatus("success");
      setMessage(`${selectedFormat.toUpperCase()} 보고서 파일 생성이 완료되었습니다.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "AI 보고서 파일을 생성하지 못했습니다.");
    }
  }

  async function remove(report: GeneratedReportItem) {
    if (!window.confirm(`${report.fileName} 파일을 목록과 저장소에서 삭제할까요?`)) return;
    setDeletingId(report.id);
    try {
      const response = await fetch(`/api/ai/report/${report.id}?organizationId=${organizationId}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "보고서 파일을 삭제하지 못했습니다.");
      setReports((current) => current.filter((item) => item.id !== report.id));
      setStatus("success");
      setMessage("보고서 파일을 삭제했습니다.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "보고서 파일을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card mt-6 overflow-hidden border-[var(--brand)]">
      <div className="bg-[var(--brand-soft)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-extrabold"><Sparkles size={17} /> AI 생성 보고서</h2>
          <div className="flex flex-wrap gap-1.5" aria-label="보고서 파일 형식 선택">
            {REPORT_FORMATS.map((format) => (
              <button
                aria-pressed={selectedFormat === format}
                className={`btn min-h-8 px-2.5 py-1 text-xs uppercase ${selectedFormat === format ? "btn-primary" : "btn-secondary"}`}
                disabled={status === "loading"}
                key={format}
                onClick={() => setSelectedFormat(format)}
                type="button"
              >
                {format}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600" role="status">{message}</p>
      </div>

      <div className="border-b border-[var(--line)] p-6 text-center">
        {status === "loading" ? <LoaderCircle className="mx-auto animate-spin text-[var(--brand)]" size={28} /> : <Sparkles className="mx-auto text-[var(--brand)]" size={28} />}
        <p className="mt-3 font-bold">{selectedFormat.toUpperCase()} 형식으로 보고서 파일 생성</p>
        <p className="muted mt-1 text-sm">생성된 파일은 R2 저장소와 아래 목록에 보관됩니다.</p>
        <button className="btn btn-primary mt-4" disabled={status === "loading"} type="button" onClick={() => void generate()}>
          {status === "loading" ? <><LoaderCircle className="animate-spin" size={16} /> 생성 중…</> : <><Sparkles size={16} /> AI 보고서 생성</>}
        </button>
        {status === "missing" && <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm"><AlertCircle className="mx-auto text-[var(--accent)]" size={20} /><p className="mt-2">키는 서버에 저장되지 않고 현재 브라우저에만 보관됩니다.</p><Link className="btn btn-secondary mt-3" href={`/org/${organizationId}/admin/settings`}>조직 관리에서 설정</Link></div>}
        {status === "error" && <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mx-auto" size={20} /><p className="mt-2">{message}</p></div>}
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold">생성된 보고서 파일</h3>
          <span className="badge badge-green">{reports.length}개</span>
        </div>
        <div className="mt-4 grid gap-3">
          {reports.map((report) => (
            <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-slate-50/70 p-4" key={report.id}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--brand)] shadow-sm"><FileText size={19} /></span>
                <div className="min-w-0">
                  <p className="truncate font-bold" title={report.fileName}>{report.fileName}</p>
                  <p className="muted mt-1 text-xs">{viewLabel[report.view] ?? report.view} · {report.referenceDate} · {report.format.toUpperCase()} · {fileSize(report.size)}</p>
                  <p className="muted mt-1 text-xs">{createdLabel(report.createdAt)}{report.createdByName ? ` · ${report.createdByName}` : ""}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a className="btn btn-secondary min-h-9 px-3 py-1.5 text-sm" href={`/api/ai/report/${report.id}?organizationId=${organizationId}`}><Download size={15} /> 다운로드</a>
                <button className="btn btn-danger min-h-9 px-3 py-1.5 text-sm" disabled={deletingId === report.id} onClick={() => void remove(report)} type="button"><Trash2 size={15} /> {deletingId === report.id ? "삭제 중…" : "삭제"}</button>
              </div>
            </article>
          ))}
          {!reports.length && <p className="muted rounded-xl bg-slate-50 py-8 text-center text-sm">아직 생성된 보고서 파일이 없습니다.</p>}
        </div>
      </div>
      {(status === "loading" || deletingId) && <LoadingOverlay label={deletingId ? "보고서 파일을 삭제하는 중…" : "AI 보고서 파일을 생성하는 중…"} />}
    </section>
  );
}
