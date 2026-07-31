import Link from "next/link";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { getOrganizationContext, listSchedules } from "@/features/queries";
import { MonthBoard, ScheduleItem, WeekBoard } from "@/components/schedule-board";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { TaskDialog } from "@/components/task-dialog";

type Search = { date?: string; new?: string };

export async function SchedulePage({
  organizationId,
  view,
  search,
}: {
  organizationId: string;
  view: "week" | "month";
  search: Search;
}) {
  const selectedDate = search.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? new Date(`${search.date}T12:00:00`) : new Date();
  const context = await getOrganizationContext(organizationId);
  const schedules = await listSchedules({
    organizationId,
    date: selectedDate,
    view,
  });
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const previous = view === "week" ? addWeeks(selectedDate, -1) : addMonths(selectedDate, -1);
  const next = view === "week" ? addWeeks(selectedDate, 1) : addMonths(selectedDate, 1);
  const profileNames = new Map(
    context.members.map((member) => [
      member.userId,
      member.profileName?.trim() || member.user.name,
    ]),
  );
  const serialized: ScheduleItem[] = schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    isAllDay: schedule.isAllDay,
    scope: schedule.scope,
    category: schedule.category,
    isImportant: schedule.isImportant,
    itemType: schedule.itemType,
    departmentId: schedule.departmentId,
    departmentName: schedule.department?.name ?? null,
    targetUserId: schedule.targetUserId,
    targetUserName: schedule.targetUserId
      ? profileNames.get(schedule.targetUserId) ?? schedule.targetUser?.name ?? null
      : null,
    creatorProfileName: schedule.createdByUserId
      ? profileNames.get(schedule.createdByUserId) ?? schedule.createdBy?.name ?? null
      : null,
  }));
  const querySuffix = (date: Date) => {
    const params = new URLSearchParams();
    params.set("date", format(date, "yyyy-MM-dd"));
    return params.toString();
  };

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{view === "week" ? "Weekly schedule" : "Monthly calendar"}</p>
          <h1 className="page-title mt-1">{view === "week" ? "주간 일정표" : "월간 캘린더"}</h1>
          <div className="mt-2 flex items-center gap-1">
            <Link className="period-arrow no-print" href={`/org/${organizationId}/schedule/${view}?${querySuffix(previous)}`} aria-label="이전 기간"><ChevronLeft size={18} /></Link>
            <p className="muted min-w-0 px-1 font-bold">{view === "week" ? `${format(weekStart, "yyyy년 M월 d일", { locale: ko })} – ${format(addDays(weekStart, 6), "M월 d일", { locale: ko })}` : format(selectedDate, "yyyy년 M월", { locale: ko })}</p>
            <Link className="period-arrow no-print" href={`/org/${organizationId}/schedule/${view}?${querySuffix(next)}`} aria-label="다음 기간"><ChevronRight size={18} /></Link>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href={`/org/${organizationId}/schedule/${view}`}>오늘로</Link>
          <Link className="btn btn-secondary" href={`/org/${organizationId}/print?${querySuffix(selectedDate)}`}><Printer size={17} /> 인쇄/PDF</Link>
          <ScheduleDialog key={`schedule-${search.new ?? "closed"}`} organizationId={organizationId} departments={context.departments.filter((department) => !department.isSystem).map(({ id, name }) => ({ id, name }))} defaultDate={format(selectedDate, "yyyy-MM-dd")} openInitially={search.new === "schedule" || search.new === "1"} />
          <TaskDialog key={`task-${search.new ?? "closed"}`} organizationId={organizationId} defaultDate={format(selectedDate, "yyyy-MM-dd")} openInitially={search.new === "task"} />
        </div>
      </header>
      {view === "week" ? (
        <WeekBoard organizationId={organizationId} days={weekDays} departments={context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }))} members={context.members.map((member) => ({ userId: member.user.id, name: member.profileName?.trim() || member.user.name, departmentId: member.departmentId }))} schedules={serialized} />
      ) : (
        <MonthBoard organizationId={organizationId} days={monthDays} currentMonth={selectedDate.getMonth()} schedules={serialized} />
      )}
      {!schedules.length && <div className="card p-8 text-center"><CalendarDays className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-bold">표시할 일정이 없습니다</p><p className="muted mt-1 text-sm">새 일정이나 업무를 등록해 보세요.</p></div>}
    </div>
  );
}
