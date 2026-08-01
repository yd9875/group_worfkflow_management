import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, CheckCircle2, Flag, Sparkles } from "lucide-react";
import { getReportData } from "@/features/queries";
import { PrintButton } from "@/components/print-button";
import { AiReportGenerator } from "@/components/ai-report-generator";

const categoryLabel: Record<string, string> = {
  GENERAL: "일반", MEETING: "회의", TRAINING: "교육", LEAVE: "휴가",
  BUSINESS_TRIP: "출장", OUTING: "외근", OTHER: "기타",
};

export default async function ReportPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const view = search.view === "day" || search.view === "month" ? search.view : "week";
  const date = search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? new Date(`${search.date}T12:00:00`) : new Date();
  const { schedules, organization } = await getReportData(organizationId, date, view);
  const tasks = schedules.filter((item) => item.itemType === "TASK");
  const completed = tasks.filter((item) => item.isCompleted);
  const important = schedules.filter((item) => item.isImportant);
  const categoryCounts = Object.entries(schedules.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.category]: (counts[item.category] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const viewLabel = view === "day" ? "일일" : view === "week" ? "주간" : "월간";
  const dateValue = format(date, "yyyy-MM-dd");
  const reportPrinciples = [
    ...(organization.reportReference?.trim() ? [organization.reportReference.trim()] : []),
    ...organization.reportReferencePrinciples.map((principle) => principle.content),
  ];

  return (
    <article className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow flex items-center gap-2"><Sparkles size={15} /> AI report draft</p><h1 className="page-title mt-1">{organization.name} {viewLabel} 보고서</h1><p className="muted mt-2">{format(date, "yyyy년 M월 d일", { locale: ko })} 기준 · 등록 일정과 조직 레퍼런스를 바탕으로 생성한 초안</p></div>
        <div className="no-print flex gap-2"><Link className="btn btn-secondary" href={`/org/${organizationId}/schedule/${view}?date=${dateValue}`}><ArrowLeft size={17} /> 일정표</Link><PrintButton /></div>
      </header>

      <AiReportGenerator organizationId={organizationId} date={dateValue} view={view} />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="muted text-sm">전체 항목</p><p className="mt-2 text-3xl font-extrabold">{schedules.length}</p></div>
        <div className="card p-5"><p className="muted text-sm">완료 업무</p><p className="mt-2 text-3xl font-extrabold">{completed.length}<span className="muted text-base"> / {tasks.length}</span></p></div>
        <div className="card p-5"><p className="muted text-sm">중요 항목</p><p className="mt-2 text-3xl font-extrabold text-[var(--accent)]">{important.length}</p></div>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-lg font-extrabold">핵심 요약</h2>
        <div className="mt-4 grid gap-3 text-sm leading-7">
          <p>총 {schedules.length}건의 일정과 업무가 등록되어 있으며, 업무 완료율은 {tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0}%입니다.</p>
          <p>{categoryCounts.length ? `가장 많은 유형은 ${categoryLabel[categoryCounts[0][0]] ?? categoryCounts[0][0]} ${categoryCounts[0][1]}건입니다.` : "보고 기간에 등록된 항목이 없습니다."}</p>
          <p>{important.length ? `중요 항목 ${important.length}건은 우선 확인이 필요합니다: ${important.slice(0, 3).map((item) => item.title).join(", ")}${important.length > 3 ? " 외" : ""}.` : "별도로 표시된 중요 항목은 없습니다."}</p>
        </div>
      </section>

      <section className="card mt-5 p-6">
        <h2 className="text-lg font-extrabold">주요 일정 및 업무</h2>
        <div className="mt-4 divide-y divide-[var(--line)]">{schedules.map((item) => <div className="flex flex-wrap items-start justify-between gap-3 py-4" key={item.id}><div><p className="font-bold">{item.isImportant && <Flag className="mr-1 inline text-[var(--accent)]" size={14} />}{item.title}</p><p className="muted mt-1 text-sm">{categoryLabel[item.category]} · {item.isAllDay ? "종일" : format(item.startsAt, "M.d HH:mm")}{item.department?.name ? ` · ${item.department.name}` : ""}</p>{item.description && <p className="mt-2 text-sm leading-6">{item.description}</p>}</div>{item.itemType === "TASK" && <span className={`badge ${item.isCompleted ? "badge-green" : "badge-gray"}`}><CheckCircle2 size={12} /> {item.isCompleted ? "완료" : "진행"}</span>}</div>)}{!schedules.length && <p className="muted py-8 text-center">보고할 일정이 없습니다.</p>}</div>
      </section>

      <section className="card mt-5 p-6"><h2 className="font-extrabold">적용된 조직 레퍼런스</h2><div className="mt-3 grid gap-2 text-sm leading-7 text-slate-600">{reportPrinciples.map((principle, index) => <p className="whitespace-pre-wrap" key={`${index}-${principle.slice(0, 20)}`}><b className="mr-2 text-[var(--brand)]">{index + 1}.</b>{principle}</p>)}{!reportPrinciples.length && <p>등록된 레퍼런스가 없습니다. 조직 관리에서 보고서 작성 원칙과 예시를 등록할 수 있습니다.</p>}</div></section>
    </article>
  );
}
