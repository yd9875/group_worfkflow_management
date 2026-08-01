import Link from "next/link";
import { addDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import {
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
  createPersonalEntryAction,
  deleteScheduleAction,
  savePersonalDailyMemoAction,
  toggleTaskCompleteAction,
  updateScheduleAction,
} from "@/features/actions";
import { getPlannerData } from "@/features/queries";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DatePickerNavigation } from "@/components/date-picker-navigation";
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

function dateTimeValue(value: Date) {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

function EntryForm({
  organizationId,
  date,
  itemType,
  item,
}: {
  organizationId: string;
  date: string;
  itemType: "SCHEDULE" | "TASK";
  item?: PlannerItem | null;
}) {
  const editing = Boolean(item);
  const startDefault = item ? dateTimeValue(item.startsAt) : `${date}T09:00`;
  const endDefault = item ? dateTimeValue(item.endsAt) : `${date}T10:00`;
  const formAction = item ? updateScheduleAction : createPersonalEntryAction;
  const isTask = itemType === "TASK";

  return (
    <form action={formAction} className={`rounded-2xl border p-5 shadow-sm ${isTask ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTask ? <ClipboardPlus className="text-amber-700" size={19} /> : <CalendarPlus2 className="text-[var(--brand)]" size={19} />}
          <h3 className="font-extrabold">{editing ? `${isTask ? "업무" : "일정"} 수정` : `새 ${isTask ? "업무" : "일정"}`}</h3>
        </div>
        <Link className="btn btn-quiet min-h-8 px-2 py-1 text-xs" href={`?date=${date}`}>닫기</Link>
      </div>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="returnDate" value={date} />
      <input type="hidden" name="itemType" value={itemType} />
      {item && <input type="hidden" name="scheduleId" value={item.id} />}
      {isTask && <input type="hidden" name="category" value="GENERAL" />}

      <div className="mt-4 grid gap-4">
        <div className={`grid gap-4 ${isTask ? "sm:grid-cols-2" : "sm:grid-cols-[10rem_minmax(0,1fr)]"}`}>
          {!isTask && (
            <label className="label">유형
              <select className="field" name="category" defaultValue={item?.category ?? "GENERAL"}>
                {Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          )}
          <label className="label">제목<input className="field" name="title" defaultValue={item?.title ?? ""} maxLength={100} required /></label>
          {isTask && <label className="label">개인 메모<input className="field" name="memo" defaultValue={item?.memo ?? ""} maxLength={4000} placeholder="준비물이나 후속 작업" /></label>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">{isTask ? "시작" : "시작 일시"}<input className="field" name="startsAt" type="datetime-local" defaultValue={startDefault} required /></label>
          <label className="label">{isTask ? "마감" : "종료 일시"}<input className="field" name="endsAt" type="datetime-local" defaultValue={endDefault} required /></label>
        </div>

        <label className="label">{isTask ? "업무 내용" : "상세 내용"}<textarea className="field min-h-24 resize-y" name="description" defaultValue={item?.description ?? ""} maxLength={2000} placeholder={isTask ? "해야 할 일을 구체적으로 적어주세요." : "장소, 참석자, 준비 사항 등을 적어주세요."} /></label>
        {!isTask && <label className="label">메모<textarea className="field min-h-20 resize-y" name="memo" defaultValue={item?.memo ?? ""} maxLength={4000} placeholder="일정과 관련된 개인 메모" /></label>}

        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl bg-white/80 p-4 text-sm">
          <label className="flex items-center gap-2"><input className="size-4 accent-[var(--accent)]" type="checkbox" name="isImportant" defaultChecked={item?.isImportant ?? false} /> 중요 {isTask ? "업무" : "일정"}</label>
          <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="showInWeek" defaultChecked={item?.showInWeek ?? true} /> 주간 일정표에 표시</label>
          <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="showInMonth" defaultChecked={item?.showInMonth ?? true} /> 월간 일정표에 표시</label>
          <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isAllDay" defaultChecked={item?.isAllDay ?? false} /> 종일</label>
          {isTask && <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isCompleted" defaultChecked={item?.isCompleted ?? false} /> 업무 완료</label>}
          {!isTask && <input type="hidden" name="isCompleted" value="off" />}
        </div>

        <div className="flex justify-end"><SubmitButton className="btn btn-primary" pendingLabel="저장 중…">{editing ? "수정 저장" : `${isTask ? "업무" : "일정"} 저장`}</SubmitButton></div>
      </div>
    </form>
  );
}

function EntryCard({ organizationId, date, item }: { organizationId: string; date: string; item: PlannerItem }) {
  const isTask = item.itemType === "TASK";
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${isTask ? "badge-orange" : "badge-green"}`}>{isTask ? "업무" : categoryLabel[item.category]}</span>
            {item.isImportant && <span className="badge badge-orange"><Flag size={12} /> 중요</span>}
            {item.isCompleted && <span className="badge badge-green"><CheckCircle2 size={12} /> 완료</span>}
            <span className="badge badge-gray">주간 {item.showInWeek ? "표시" : "숨김"}</span>
            <span className="badge badge-gray">월간 {item.showInMonth ? "표시" : "숨김"}</span>
          </div>
          <h3 className={`mt-3 text-lg font-extrabold ${item.isCompleted ? "text-slate-400 line-through" : ""}`}>{item.title}</h3>
          <p className="muted mt-2 flex items-center gap-2 text-sm"><Clock3 size={15} /> {item.isAllDay ? "종일" : `${format(item.startsAt, "HH:mm")}–${format(item.endsAt, "HH:mm")}`}</p>
          {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.description}</p>}
          {item.memo && <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><StickyNote className="mt-1 shrink-0" size={15} />{item.memo}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
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
  const { items, editItem, personalMemo } = await getPlannerData(organizationId, selectedDate, search.edit);
  const date = format(selectedDate, "yyyy-MM-dd");
  const schedules = items.filter((item) => item.itemType === "SCHEDULE");
  const tasks = items.filter((item) => item.itemType === "TASK");
  const requestedNewType = search.new === "task" ? "TASK" : search.new === "schedule" ? "SCHEDULE" : null;
  const activeFormType = editItem?.itemType ?? requestedNewType;

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
          <Link className="btn btn-primary" href={`?date=${date}&new=schedule`}><CalendarPlus2 size={17} /> 일정 추가</Link>
          <Link className="btn btn-secondary" href={`?date=${date}&new=task`}><ClipboardPlus size={17} /> 업무 추가</Link>
        </div>
      </header>

      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Schedule</p><h2 className="mt-1 text-xl font-extrabold">일정</h2></div><span className="badge badge-green">{schedules.length}개</span></div>
        {activeFormType === "SCHEDULE" && <EntryForm organizationId={organizationId} date={date} itemType="SCHEDULE" item={editItem?.itemType === "SCHEDULE" ? editItem : null} />}
        <div className="grid gap-3">{schedules.map((item) => <EntryCard organizationId={organizationId} date={date} item={item} key={item.id} />)}{!schedules.length && activeFormType !== "SCHEDULE" && <p className="muted rounded-xl bg-slate-50 py-8 text-center text-sm">등록된 일정이 없습니다. 위의 일정 추가 버튼으로 시작하세요.</p>}</div>
      </section>

      <section className="card grid gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Tasks</p><h2 className="mt-1 text-xl font-extrabold">업무</h2></div><span className="badge badge-orange">{tasks.length}개</span></div>
        {activeFormType === "TASK" && <EntryForm organizationId={organizationId} date={date} itemType="TASK" item={editItem?.itemType === "TASK" ? editItem : null} />}
        <div className="grid gap-3">{tasks.map((item) => <EntryCard organizationId={organizationId} date={date} item={item} key={item.id} />)}{!tasks.length && activeFormType !== "TASK" && <p className="muted rounded-xl bg-slate-50 py-8 text-center text-sm">등록된 업무가 없습니다. 위의 업무 추가 버튼으로 시작하세요.</p>}</div>
      </section>

      <form action={savePersonalDailyMemoAction} className="card p-5 sm:p-6">
        <div className="flex items-center gap-3"><NotebookPen className="text-[var(--brand)]" /><div><h2 className="text-xl font-extrabold">개인 메모</h2><p className="muted mt-1 text-sm">이 날짜에 필요한 자유 메모를 남겨두세요.</p></div></div>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="date" value={date} />
        <textarea className="field mt-4 min-h-52 resize-y" name="content" defaultValue={personalMemo} maxLength={20000} placeholder="메모를 입력하세요. 오른쪽 아래를 드래그해 입력 영역의 크기를 조절할 수 있습니다." />
        <div className="mt-3 flex justify-end"><SubmitButton className="btn btn-primary" pendingLabel="저장 중…"><StickyNote size={16} /> 메모 저장</SubmitButton></div>
      </form>
    </div>
  );
}
