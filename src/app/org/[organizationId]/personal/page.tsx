import Link from "next/link";
import { addDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarPlus2, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { createPersonalEntryAction, deleteScheduleAction, updateScheduleAction } from "@/features/actions";
import { getPlannerData } from "@/features/queries";
import { SubmitButton } from "@/components/submit-button";

const categoryLabel: Record<string, string> = {
  GENERAL: "일반", MEETING: "회의", TRAINING: "교육", LEAVE: "휴가",
  BUSINESS_TRIP: "출장", OUTING: "외근", OTHER: "기타",
};

function dateTimeValue(value: Date) {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

export default async function PersonalPlannerPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const selectedDate = search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? new Date(`${search.date}T12:00:00`) : new Date();
  const { items, editItem } = await getPlannerData(organizationId, selectedDate, search.edit);
  const date = format(selectedDate, "yyyy-MM-dd");
  const startDefault = editItem ? dateTimeValue(editItem.startsAt) : `${date}T09:00`;
  const endDefault = editItem ? dateTimeValue(editItem.endsAt) : `${date}T10:00`;
  const formAction = editItem ? updateScheduleAction : createPersonalEntryAction;

  return (
    <div className="grid gap-6">
      <header>
        <p className="eyebrow">Personal planner</p>
        <h1 className="page-title mt-1">개인 일정관리</h1>
        <div className="mt-3 flex items-center gap-1">
          <Link className="period-arrow" href={`?date=${format(addDays(selectedDate, -1), "yyyy-MM-dd")}`} aria-label="이전 날짜"><ChevronLeft size={18} /></Link>
          <p className="muted px-2 font-bold">{format(selectedDate, "yyyy년 M월 d일 EEEE", { locale: ko })}</p>
          <Link className="period-arrow" href={`?date=${format(addDays(selectedDate, 1), "yyyy-MM-dd")}`} aria-label="다음 날짜"><ChevronRight size={18} /></Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <form action={formAction} className="card p-6">
          <div className="flex items-center gap-3"><CalendarPlus2 className="text-[var(--brand)]" /><div><h2 className="text-lg font-extrabold">{editItem ? "일정·업무 수정" : "개인 일정·업무 입력"}</h2><p className="muted mt-1 text-sm">세부 내용과 일정표 표시 여부를 함께 관리합니다.</p></div></div>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="returnDate" value={date} />
          {editItem && <input type="hidden" name="scheduleId" value={editItem.id} />}
          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">항목 유형<select className="field" name="itemType" defaultValue={editItem?.itemType ?? "SCHEDULE"}><option value="SCHEDULE">일정</option><option value="TASK">업무</option></select></label>
              <label className="label">분류<select className="field" name="category" defaultValue={editItem?.category ?? "GENERAL"}>{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label className="label">제목<input className="field" name="title" defaultValue={editItem?.title ?? ""} maxLength={100} required /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="label">시작<input className="field" name="startsAt" type="datetime-local" defaultValue={startDefault} required /></label><label className="label">종료<input className="field" name="endsAt" type="datetime-local" defaultValue={endDefault} required /></label></div>
            <label className="label">상세 내용<textarea className="field" name="description" defaultValue={editItem?.description ?? ""} maxLength={2000} placeholder="일일 계획에서 확인할 상세 내용을 입력하세요." /></label>
            <label className="label">개인 메모<textarea className="field" name="memo" defaultValue={editItem?.memo ?? ""} maxLength={4000} placeholder="준비물, 링크, 후속 작업 등 개인 메모" /></label>
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="showInWeek" defaultChecked={editItem?.showInWeek ?? true} /> 주간 일정표에 표시</label>
              <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="showInMonth" defaultChecked={editItem?.showInMonth ?? true} /> 월간 일정표에 표시</label>
              <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isAllDay" defaultChecked={editItem?.isAllDay ?? false} /> 종일</label>
              <label className="flex items-center gap-2"><input className="size-4 accent-[var(--accent)]" type="checkbox" name="isImportant" defaultChecked={editItem?.isImportant ?? false} /> 중요 항목</label>
              <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isCompleted" defaultChecked={editItem?.isCompleted ?? false} /> 업무 완료</label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">{editItem && <Link className="btn btn-secondary" href={`?date=${date}`}>수정 취소</Link>}<SubmitButton className="btn btn-primary" pendingLabel="저장 중…">{editItem ? "수정 저장" : "개인 항목 저장"}</SubmitButton></div>
          </div>
        </form>

        <aside className="card h-fit p-5">
          <h2 className="font-extrabold">이날의 개인 항목</h2>
          <div className="mt-4 grid gap-3">
            {items.map((item) => <article className="rounded-xl border border-[var(--line)] p-3" key={item.id}><div className="flex items-start justify-between gap-2"><div><span className="badge badge-gray">{item.itemType === "TASK" ? "업무" : categoryLabel[item.category]}</span><h3 className={`mt-2 font-bold ${item.isCompleted ? "text-slate-400 line-through" : ""}`}>{item.title}</h3><p className="muted mt-1 text-xs">{item.isAllDay ? "종일" : `${format(item.startsAt, "HH:mm")}–${format(item.endsAt, "HH:mm")}`}</p></div>{item.isCompleted && <CheckCircle2 className="text-[var(--brand)]" size={18} />}</div><div className="mt-3 flex gap-2"><Link className="btn btn-secondary min-h-8 flex-1 px-2 py-1 text-xs" href={`?date=${date}&edit=${item.id}`}><Pencil size={12} /> 수정</Link><form action={deleteScheduleAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="scheduleId" value={item.id} /><SubmitButton className="btn btn-danger min-h-8 px-2 py-1 text-xs" pendingLabel="삭제 중…"><Trash2 size={12} /></SubmitButton></form></div></article>)}
            {!items.length && <p className="muted py-6 text-center text-sm">등록된 개인 항목이 없습니다.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
