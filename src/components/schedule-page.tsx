import Link from "next/link";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Printer, SlidersHorizontal, Sparkles } from "lucide-react";
import { getScheduleContext, listSchedules } from "@/features/queries";
import { getReferenceRange } from "@/features/schedule-periods";
import { DayBoard, MonthBoard, ScheduleItem, WeekBoard } from "@/components/schedule-board";
import { DatePickerNavigation } from "@/components/date-picker-navigation";
import { SubmitButton } from "@/components/submit-button";

type SearchValue = string | string[] | undefined;
type Search = {
  date?: SearchValue;
  category?: SearchValue;
  department?: SearchValue;
  member?: SearchValue;
};

const categoryOptions = [
  ["GENERAL", "일반"],
  ["MEETING", "회의"],
  ["TRAINING", "교육"],
  ["BUSINESS_TRIP", "출장"],
  ["OUTING", "외근"],
  ["OTHER", "기타"],
  ["LEAVE", "휴가"],
  ["TASK", "업무"],
] as const;

const viewCopy = {
  day: { eyebrow: "Daily plan", title: "일일 계획" },
  week: { eyebrow: "Weekly schedule", title: "주간 일정표" },
  month: { eyebrow: "Monthly calendar", title: "월간 일정표" },
} as const;

function one(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: SearchValue) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export async function SchedulePage({ organizationId, view, search }: { organizationId: string; view: "day" | "week" | "month"; search: Search }) {
  const dateParam = one(search.date);
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? new Date(`${dateParam}T12:00:00`) : new Date();
  const selectedCategories = many(search.category);
  const department = one(search.department);
  const member = one(search.member);
  const referenceRange = getReferenceRange(selectedDate, view);
  const [context, schedules, referenceSchedules] = await Promise.all([
    getScheduleContext(organizationId),
    listSchedules({
      organizationId,
      date: selectedDate,
      view,
      categories: selectedCategories,
      departmentId: department,
      memberId: member,
      dayCount: view === "day" ? 2 : undefined,
    }),
    listSchedules({
      organizationId,
      date: referenceRange.start,
      view: view === "day" ? "week" : "month",
      categories: selectedCategories,
      departmentId: department,
      memberId: member,
      rangeStart: referenceRange.start,
      rangeEnd: referenceRange.end,
    }),
  ]);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const previous = view === "day" ? addDays(selectedDate, -1) : view === "week" ? addWeeks(selectedDate, -1) : addMonths(selectedDate, -1);
  const next = view === "day" ? addDays(selectedDate, 1) : view === "week" ? addWeeks(selectedDate, 1) : addMonths(selectedDate, 1);
  const profileNames = new Map(context.members.map((item) => [item.userId, item.profileName?.trim() || item.user.name]));
  const serialize = (schedule: (typeof schedules)[number]): ScheduleItem => ({
    ...schedule,
    departmentName: schedule.department?.name ?? null,
    targetUserName: schedule.targetUserId ? profileNames.get(schedule.targetUserId) ?? schedule.targetUser?.name ?? null : null,
    creatorProfileName: schedule.createdByUserId ? profileNames.get(schedule.createdByUserId) ?? schedule.createdBy?.name ?? null : null,
  });
  const serialized = schedules.map(serialize);
  const serializedReferences = referenceSchedules.map(serialize);
  const referenceDays = eachDayOfInterval({ start: referenceRange.start, end: addDays(referenceRange.end, -1) });
  const dateValue = format(selectedDate, "yyyy-MM-dd");
  const querySuffix = (date: Date, keepFilters = true) => {
    const params = new URLSearchParams({ date: format(date, "yyyy-MM-dd") });
    if (keepFilters) selectedCategories.forEach((category) => params.append("category", category));
    if (keepFilters && department) params.set("department", department);
    if (keepFilters && member) params.set("member", member);
    return params.toString();
  };
  const periodLabel = view === "day"
    ? format(selectedDate, "yyyy년 M월 d일 EEEE", { locale: ko })
    : view === "week"
      ? `${format(weekStart, "yyyy년 M월 d일", { locale: ko })} – ${format(addDays(weekStart, 6), "M월 d일", { locale: ko })}`
      : format(selectedDate, "yyyy년 M월", { locale: ko });

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{viewCopy[view].eyebrow}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="page-title">{viewCopy[view].title}</h1>
            <Link className="btn btn-secondary no-print min-h-9 px-3 py-1.5 text-sm" href={`/org/${organizationId}/schedule/${view}`}>오늘로</Link>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Link className="period-arrow no-print" href={`/org/${organizationId}/schedule/${view}?${querySuffix(previous)}`} aria-label="이전 기간"><ChevronLeft size={18} /></Link>
            {view === "day" ? (
              <DatePickerNavigation
                basePath={`/org/${organizationId}/schedule/day`}
                date={dateValue}
                label={periodLabel}
                query={{ category: selectedCategories, department, member }}
              />
            ) : <p className="muted min-w-0 px-1 font-bold">{periodLabel}</p>}
            <Link className="period-arrow no-print" href={`/org/${organizationId}/schedule/${view}?${querySuffix(next)}`} aria-label="다음 기간"><ChevronRight size={18} /></Link>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={`/org/${organizationId}/report?view=${view}&date=${dateValue}`}><Sparkles size={17} /> AI 보고서</Link>
          <Link className="btn btn-secondary" href={`/org/${organizationId}/print?view=${view}&${querySuffix(selectedDate)}`}><Printer size={17} /> 인쇄/PDF</Link>
        </div>
      </header>

      <form method="get" action={`/org/${organizationId}/schedule/${view}`} className="card no-print flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="date" value={dateValue} />
        <fieldset className="min-w-full">
          <legend className="label flex items-center gap-2"><SlidersHorizontal className="text-[var(--brand)]" size={18} /> 일정 유형</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            {categoryOptions.map(([value, label]) => (
              <label className="flex items-center gap-2" key={value}>
                <input className="size-4 accent-[var(--brand)]" type="checkbox" name="category" value={value} defaultChecked={selectedCategories.includes(value)} /> {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="label min-w-36 flex-1">부서<select className="field" name="department" defaultValue={department ?? ""}><option value="">전체 부서</option>{context.departments.filter((item) => !item.isSystem).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="label min-w-36 flex-1">구성원<select className="field" name="member" defaultValue={member ?? ""}><option value="">전체 구성원</option>{context.members.map((item) => <option key={item.userId} value={item.userId}>{item.profileName?.trim() || item.user.name}</option>)}</select></label>
        <SubmitButton className="btn btn-secondary" pendingLabel="필터 적용 중…">필터 적용</SubmitButton>
        <Link className="btn btn-quiet" href={`/org/${organizationId}/schedule/${view}?date=${dateValue}`}>초기화</Link>
      </form>

      {view === "day" ? (
        <DayBoard organizationId={organizationId} days={[selectedDate, addDays(selectedDate, 1)]} departments={context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }))} schedules={serialized} />
      ) : view === "week" ? (
        <WeekBoard organizationId={organizationId} days={weekDays} departments={context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }))} schedules={serialized} />
      ) : (
        <MonthBoard organizationId={organizationId} days={monthDays} currentMonth={selectedDate.getMonth()} schedules={serialized} />
      )}
      {!serialized.length && <div className="card p-8 text-center"><CalendarDays className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-bold">표시할 일정이 없습니다</p><p className="muted mt-1 text-sm">개인 일정 관리에서 일정이나 업무를 등록하거나 필터를 초기화해 보세요.</p><Link className="btn btn-primary mt-4" href={`/org/${organizationId}/personal?date=${dateValue}`}>개인 일정 관리 열기</Link></div>}

      <section className="mt-3 grid gap-4" aria-labelledby="reference-schedule-title">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Reference schedule</p>
            <h2 className="mt-1 text-xl font-extrabold" id="reference-schedule-title">
              {view === "day" ? "참고용 주간 계획표" : view === "week" ? "참고용 다음 4주 일정표" : "참고용 다음 달 일정표"}
            </h2>
            <p className="muted mt-1 text-sm">현재 적용한 필터와 동일하게 표시됩니다.</p>
          </div>
          <span className="badge badge-gray">AI 보고서 제외</span>
        </header>

        {view === "day" ? [0, 1].map((weekOffset) => {
          const referenceWeekStart = addWeeks(referenceRange.start, weekOffset);
          const referenceWeekDays = Array.from({ length: 7 }, (_, index) => addDays(referenceWeekStart, index));
          return (
            <div className="grid gap-2" key={referenceWeekStart.toISOString()}>
              <h3 className="text-sm font-extrabold">
                {weekOffset === 0 ? "해당 주" : "다음 주"} · {format(referenceWeekStart, "M월 d일", { locale: ko })} – {format(addDays(referenceWeekStart, 6), "M월 d일", { locale: ko })}
              </h3>
              <WeekBoard organizationId={organizationId} days={referenceWeekDays} departments={context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }))} schedules={serializedReferences} readOnly />
            </div>
          );
        }) : view === "week" ? (
          <div className="grid gap-2">
            <p className="text-sm font-extrabold">{format(referenceRange.start, "yyyy년 M월 d일", { locale: ko })} – {format(addDays(referenceRange.end, -1), "M월 d일", { locale: ko })}</p>
            <MonthBoard organizationId={organizationId} days={referenceDays} schedules={serializedReferences} readOnly />
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="text-sm font-extrabold">{format(addMonths(selectedDate, 1), "yyyy년 M월", { locale: ko })}</p>
            <MonthBoard organizationId={organizationId} days={referenceDays} currentMonth={addMonths(selectedDate, 1).getMonth()} schedules={serializedReferences} readOnly />
          </div>
        )}
      </section>
    </div>
  );
}
