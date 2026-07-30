import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { getOrganizationContext, listSchedules } from "@/features/queries";
import { WeekBoard, type ScheduleItem } from "@/components/schedule-board";
import { PrintButton } from "@/components/print-button";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const selectedDate = search.date ? new Date(`${search.date}T12:00:00`) : new Date();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const context = await getOrganizationContext(organizationId);
  const schedules = await listSchedules({
    organizationId,
    date: selectedDate,
    view: "week",
    departments: search.department ? [search.department] : undefined,
    scopes: search.scope ? [search.scope as "ORGANIZATION" | "DEPARTMENT" | "PERSONAL"] : undefined,
    categories: search.category ? [search.category as never] : undefined,
    important: search.important === "1",
    search: search.q,
  });
  const items: ScheduleItem[] = schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    isAllDay: schedule.isAllDay,
    scope: schedule.scope,
    category: schedule.category,
    isImportant: schedule.isImportant,
    departmentId: schedule.departmentId,
    departmentName: schedule.department?.name ?? null,
    targetUserId: schedule.targetUserId,
    targetUserName: schedule.targetUser?.name ?? null,
  }));
  const filters = [
    search.department ? "부서 필터 적용" : "모든 부서",
    search.scope ? `범위 ${search.scope}` : "모든 범위",
    search.category ? `분류 ${search.category}` : "모든 분류",
    search.important === "1" ? "중요 일정만" : null,
  ].filter(Boolean).join(" · ");

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Printable schedule</p>
          <h1 className="page-title mt-1">{context.membership.organization.name} 주간 일정표</h1>
          <p className="muted mt-2 text-sm">{format(weekStart, "yyyy.MM.dd")} – {format(addDays(weekStart, 6), "yyyy.MM.dd")} · {filters}</p>
          <p className="muted mt-1 text-xs">출력 시각 {new Date().toLocaleString("ko-KR")}</p>
        </div>
        <div className="no-print flex gap-2">
          <Link className="btn btn-secondary" href={`/org/${organizationId}/schedule/week?date=${format(selectedDate, "yyyy-MM-dd")}`}>일정표로 돌아가기</Link>
          <PrintButton />
        </div>
      </header>
      <WeekBoard organizationId={organizationId} days={days} departments={context.departments.map(({ id, name }) => ({ id, name }))} members={context.members.map(({ user, departmentId }) => ({ userId: user.id, name: user.name, departmentId }))} schedules={items} />
    </section>
  );
}
