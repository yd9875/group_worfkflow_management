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
  });
  const profileNames = new Map(
    context.members.map((member) => [
      member.userId,
      member.profileName?.trim() || member.user.name,
    ]),
  );
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

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Printable schedule</p>
          <h1 className="page-title mt-1">{context.membership.organization.name} 주간 일정표</h1>
          <p className="muted mt-2 text-sm">{format(weekStart, "yyyy.MM.dd")} – {format(addDays(weekStart, 6), "yyyy.MM.dd")}</p>
          <p className="muted mt-1 text-xs">출력 시각 {new Date().toLocaleString("ko-KR")}</p>
        </div>
        <div className="no-print flex gap-2">
          <Link className="btn btn-secondary" href={`/org/${organizationId}/schedule/week?date=${format(selectedDate, "yyyy-MM-dd")}`}>일정표로 돌아가기</Link>
          <PrintButton />
        </div>
      </header>
      <WeekBoard organizationId={organizationId} days={days} departments={context.departments.map(({ id, name, isSystem }) => ({ id, name, isSystem }))} members={context.members.map((member) => ({ userId: member.user.id, name: member.profileName?.trim() || member.user.name, departmentId: member.departmentId }))} schedules={items} />
    </section>
  );
}
