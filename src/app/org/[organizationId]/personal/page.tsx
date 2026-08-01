import Link from "next/link";
import { addDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  Clock3,
  Flag,
  NotebookPen,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  createPersonalDailyMemoAction,
  deletePersonalDailyMemoAction,
  deleteScheduleAction,
  movePersonalEntryAction,
  toggleTaskCompleteAction,
  updatePersonalDailyMemoAction,
} from "@/features/actions";
import { getPlannerData } from "@/features/queries";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DatePickerNavigation } from "@/components/date-picker-navigation";
import { PersonalEntryForm, type PersonalEntryFormItem } from "@/components/personal-entry-form";
import { SubmitButton } from "@/components/submit-button";

const categoryLabel: Record<string, string> = {
  GENERAL: "일반",
  MEETING: "회의",
  TRAINING: "교육",
  LEAVE: "휴가",
  BUSINESS_TRIP: "출장",
  OUTING: "외근",
  OTHER: "기타",
};

type PlannerData = Awaited<ReturnType<typeof getPlannerData>>;
type PlannerItem = PlannerData["items"][number];

function toFormItem(item: PlannerItem | null | undefined): PersonalEntryFormItem | null {
  if (!item) return null;
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description,
    memo: item.memo,
    startsAt: format(item.startsAt, "yyyy-MM-dd'T'HH:mm"),
    endsAt: format(item.endsAt, "yyyy-MM-dd'T'HH:mm"),
    isAllDay: item.isAllDay,
    isImportant: item.isImportant,
    showInWeek: item.showInWeek,
    showInMonth: item.showInMonth,
    isCompleted: item.isCompleted,
    departmentId: item.departmentId,
  };
}

function MoveButton({ organizationId, date, itemId, direction, disabled }: {
  organizationId: string;
  date: string;
  itemId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={movePersonalEntryAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="scheduleId" value={itemId} />
      <input type="hidden" name="returnDate" value={date} />
      <input type="hidden" name="direction" value={direction} />
      <SubmitButton className="btn btn-quiet min-h-8 px-2 py-1 text-xs" disabled={disabled} pendingLabel="이동 중…" aria-label={direction === "up" ? "위로 이동" : "아래로 이동"}>
        {direction === "up" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
      </SubmitButton>
    </form>
  );
}

function EntryCard({ organizationId, date, item, index, total }: {
  organizationId: string;
  date: string;
  item: PlannerItem;
  index: number;
  total: number;
}) {
  const isTask = item.itemType === "TASK";
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isTask ? "badge-orange" : "badge-green"}`}>{isTask ? "업무" : categoryLabel[item.category]}</span>
            {item.isImportant && <span className="badge badge-orange"><Flag size={12} /> 중요</span>}
            {item.isCompleted && <span className="badge badge-green"><CheckCircle2 size={12} /> 완료</span>}
            <span className="badge badge-gray">일정표 {item.showInWeek ? "표시" : "숨김"}</span>
          </div>
          <h3 className={`mt-3 text-lg font-extrabold ${item.isCompleted ? "text-slate-400 line-through" : ""}`}>{item.title}</h3>
          {!isTask && <p className="muted mt-2 flex items-center gap-2 text-sm"><Clock3 size={15} /> {item.isAllDay ? "종일" : `${format(item.startsAt, "HH:mm")}–${format(item.endsAt, "HH:mm")}`}</p>}
          {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.description}</p>}
          {item.memo && <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><StickyNote className="mt-1 shrink-0" size={15} />{item.memo}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <MoveButton organizationId={organizationId} date={date} itemId={item.id} direction="up" disabled={index === 0} />
          <MoveButton organizationId={organizationId} date={date} itemId={item.id} direction="down" disabled={index === total - 1} />
          {isTask && (
            <form action={toggleTaskCompleteAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="scheduleId" value={item.id} />
              <SubmitButton className="btn btn-secondary min-h-8 px-2 py-1 text-xs" pendingLabel="처리 중…">{item.isCompleted ? "완료 취소" : "완료 처리"}</SubmitButton>
            </form>
          )}
          <Link className="btn btn-secondary min-h-8 px-2 py-1 text-xs" href={`?date=${date}&edit=${item.id}`}><Pencil size={13} /> 수정</Link>
          <form action={deleteScheduleAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="scheduleId" value={item.id} />
            <ConfirmSubmitButton className="btn btn-danger min-h-8 px-2 py-1 text-xs" message={`${item.title} 항목을 삭제할까요?`}><Trash2 size={13} /> 삭제</ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </article>
  );
}

export default async function PersonalPlannerPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const selectedDate = search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? new Date(`${search.date}T12:00:00`) : new Date();
  const { membership, items, editItem, personalMemos } = await getPlannerData(organizationId, selectedDate, search.edit);
  const date = format(selectedDate, "yyyy-MM-dd");
  const schedules = items.filter((item) => item.itemType === "SCHEDULE");
  const tasks = items.filter((item) => item.itemType === "TASK");
  const requestedNewTypes = new Set((search.new ?? "").split(",").filter((value) => value === "schedule" || value === "task"));
  const showScheduleForm = editItem?.itemType === "SCHEDULE" || (!editItem && requestedNewTypes.has("schedule"));
  const showTaskForm = editItem?.itemType === "TASK" || (!editItem && requestedNewTypes.has("task"));
  const addFormHref = (type: "schedule" | "task") => {
    const next = new Set(requestedNewTypes);
    next.add(type);
    return `?date=${date}&new=${Array.from(next).join(",")}`;
  };
  const closeFormHref = (type: "schedule" | "task") => {
    if (editItem) return `?date=${date}`;
    const next = new Set(requestedNewTypes);
    next.delete(type);
    const query = Array.from(next).join(",");
    return query ? `?date=${date}&new=${query}` : `?date=${date}`;
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Personal planner</p>
          <h1 className="page-title mt-1">개인 일정 관리</h1>
          <div className="mt-3 flex items-center gap-1">
            <Link className="period-arrow" href={`?date=${format(addDays(selectedDate, -1), "yyyy-MM-dd")}`} aria-label="이전 날짜"><ChevronLeft size={18} /></Link>
            <DatePickerNavigation basePath={`/org/${organizationId}/personal`} date={date} label={format(selectedDate, "yyyy년 M월 d일 EEEE", { locale: ko })} />
            <Link className="period-arrow" href={`?date=${format(addDays(selectedDate, 1), "yyyy-MM-dd")}`} aria-label="다음 날짜"><ChevronRight size={18} /></Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={addFormHref("schedule")}><CalendarPlus2 size={17} /> 일정 추가</Link>
          <Link className="btn btn-primary" href={addFormHref("task")}><ClipboardPlus size={17} /> 업무 추가</Link>
        </div>
      </header>

      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Schedule</p><h2 className="mt-1 text-xl font-extrabold">일정</h2></div><span className="badge badge-green">{schedules.length}개</span></div>
        {showScheduleForm && <PersonalEntryForm key={editItem?.itemType === "SCHEDULE" ? editItem.id : "new-schedule"} organizationId={organizationId} date={date} itemType="SCHEDULE" item={toFormItem(editItem?.itemType === "SCHEDULE" ? editItem : null)} closeHref={closeFormHref("schedule")} department={membership.department} />}
        <div className="grid gap-3">{schedules.map((item, index) => <EntryCard organizationId={organizationId} date={date} item={item} index={index} total={schedules.length} key={item.id} />)}{!schedules.length && !showScheduleForm && <p className="muted rounded-xl bg-slate-50 py-8 text-center text-sm">등록된 일정이 없습니다. 위의 일정 추가 버튼으로 시작하세요.</p>}</div>
      </section>

      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Tasks</p><h2 className="mt-1 text-xl font-extrabold">업무</h2></div><span className="badge badge-orange">{tasks.length}개</span></div>
        {showTaskForm && <PersonalEntryForm key={editItem?.itemType === "TASK" ? editItem.id : "new-task"} organizationId={organizationId} date={date} itemType="TASK" item={toFormItem(editItem?.itemType === "TASK" ? editItem : null)} closeHref={closeFormHref("task")} department={membership.department} />}
        <div className="grid gap-3">{tasks.map((item, index) => <EntryCard organizationId={organizationId} date={date} item={item} index={index} total={tasks.length} key={item.id} />)}{!tasks.length && !showTaskForm && <p className="muted rounded-xl bg-slate-50 py-8 text-center text-sm">등록된 업무가 없습니다. 위의 업무 추가 버튼으로 시작하세요.</p>}</div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-3"><NotebookPen className="text-[var(--brand)]" /><div><h2 className="text-xl font-extrabold">개인 메모</h2><p className="muted mt-1 text-sm">이 날짜에 필요한 메모를 여러 개 저장하고 관리할 수 있습니다.</p></div></div>
        <form action={createPersonalDailyMemoAction} className="mt-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="date" value={date} />
          <textarea className="field min-h-36 resize-y" name="content" maxLength={20000} placeholder="메모를 입력하세요. 이 내용은 일정표에는 표시되지 않습니다." required />
          <div className="mt-3 flex justify-end"><SubmitButton className="btn btn-primary" pendingLabel="저장 중…"><StickyNote size={16} /> 메모 저장</SubmitButton></div>
        </form>

        <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">
          {personalMemos.map((memo, index) => (
            <article className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4" key={memo.id}>
              <div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-extrabold">메모 {index + 1}</p><p className="muted text-xs">{format(memo.updatedAt, "yyyy.MM.dd HH:mm")}</p></div>
              <form action={updatePersonalDailyMemoAction}>
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="memoId" value={memo.id} />
                <input type="hidden" name="date" value={date} />
                <textarea className="field min-h-28 resize-y" name="content" defaultValue={memo.content} maxLength={20000} required />
                <div className="mt-3 flex justify-end"><SubmitButton className="btn btn-secondary min-h-9 px-3 py-1.5 text-sm" pendingLabel="수정 중…"><Pencil size={14} /> 수정 저장</SubmitButton></div>
              </form>
              <form action={deletePersonalDailyMemoAction} className="mt-2 flex justify-end">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="memoId" value={memo.id} />
                <input type="hidden" name="date" value={date} />
                <ConfirmSubmitButton className="btn btn-danger min-h-9 px-3 py-1.5 text-sm" message="이 메모를 삭제할까요?"><Trash2 size={14} /> 삭제</ConfirmSubmitButton>
              </form>
            </article>
          ))}
          {!personalMemos.length && <p className="muted rounded-xl bg-slate-50 py-7 text-center text-sm">저장된 개인 메모가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
