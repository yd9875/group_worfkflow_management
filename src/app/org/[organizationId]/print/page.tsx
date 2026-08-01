import Link from "next/link";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import { getScheduleContext, listSchedules } from "@/features/queries";
import { DayBoard, MonthBoard, WeekBoard, type ScheduleItem } from "@/components/schedule-board";
import { PrintButton } from "@/components/print-button";

const viewCopy = {
  day: { title: "일일 계획", eyebrow: "Printable daily plan" },
  week: { title: "주간 일정표", eyebrow: "Printable weekly schedule" },
  month: { title: "월간 일정표", eyebrow: "Printable monthly calendar" },
} as const;

type SearchValue = string | string[] | undefined;

function one(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: SearchValue) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const viewParam = one(search.view);
  const view = viewParam === "day" || viewParam === "month" ? viewParam : "week";
  const dateParam = one(search.date);
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? new Date(`${dateParam}T12:00:00`)
    : new Date();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const [context, schedules] = await Promise.all([
    getScheduleContext(organizationId),
    listSchedules({
      organizationId,
      date: selectedDate,
      view,
      categories: many(search.category),
      departmentId: one(search.department),
      memberId: one(search.member),
    }),
  ]);
  const profileNames = new Map(
    context.members.map((member) => [member.userId, member.profileName?.trim() || member.user.name]),
  );
  const items: ScheduleItem[] = schedules.map((schedule) => ({
    ...schedule,
    departmentName: schedule.department?.name ?? null,
    targetUserId: schedule.targetUserId,
    targetUserName: schedule.targetUserId
      ? profileNames.get(schedule.targetUserId) ?? schedule.targetUser?.name ?? null
      : null,
    creatorProfileName: schedule.createdByUserId
      ? profileNames.get(schedule.createdByUserId) ?? schedule.createdBy?.name ?? null
      : null,
  }));
  const periodLabel = view === "day"
    ? format(selectedDate, "yyyy년 M월 d일 EEEE", { locale: ko })
    : view === "week"
      ? `${format(weekStart, "yyyy.MM.dd")} – ${format(addDays(weekStart, 6), "yyyy.MM.dd")}`
      : format(selectedDate, "yyyy년 M월", { locale: ko });
  const departments = context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }));

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{viewCopy[view].eyebrow}</p>
          <h1 className="page-title mt-1">{context.membership.organization.name} {viewCopy[view].title}</h1>
          <p className="muted mt-2 text-sm">{periodLabel}</p>
          <p className="muted mt-1 text-xs">출력 시각 {new Date().toLocaleString("ko-KR")}</p>
        </div>
        <div className="no-print flex gap-2">
          <Link className="btn btn-secondary" href={`/org/${organizationId}/schedule/${view}?date=${format(selectedDate, "yyyy-MM-dd")}`}>일정표로 돌아가기</Link>
          <PrintButton />
        </div>
      </header>
      {view === "day" ? (
        <DayBoard organizationId={organizationId} day={selectedDate} departments={departments} schedules={items} />
      ) : view === "week" ? (
        <WeekBoard organizationId={organizationId} days={weekDays} departments={departments} schedules={items} />
      ) : (
        <MonthBoard organizationId={organizationId} days={monthDays} currentMonth={selectedDate.getMonth()} schedules={items} />
      )}
    </section>
  );
}
