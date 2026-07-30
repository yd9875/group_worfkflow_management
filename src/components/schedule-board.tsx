import { format, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Flag, Trash2 } from "lucide-react";
import { deleteScheduleAction } from "@/features/actions";

export type ScheduleItem = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
  scope: "ORGANIZATION" | "DEPARTMENT" | "PERSONAL";
  category: string;
  isImportant: boolean;
  departmentId: string | null;
  departmentName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
};

type Row = { id: string; label: string; kind: "organization" | "department" | "member"; departmentId?: string; userId?: string };

const scopeLabel = { ORGANIZATION: "조직", DEPARTMENT: "부서", PERSONAL: "개인" };
const categoryLabel: Record<string, string> = { GENERAL: "일반", MEETING: "회의", TRAINING: "교육", LEAVE: "휴가", BUSINESS_TRIP: "출장", OUTING: "외출", OTHER: "기타" };

function belongsToRow(schedule: ScheduleItem, row: Row) {
  if (schedule.scope === "ORGANIZATION") return row.kind === "organization";
  if (schedule.scope === "DEPARTMENT") return row.kind === "department" && schedule.departmentId === row.departmentId;
  return row.kind === "member" && schedule.targetUserId === row.userId;
}

function occursOnDay(schedule: ScheduleItem, day: Date) {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(24, 0, 0, 0);
  return schedule.startsAt < dayEnd && schedule.endsAt > dayStart;
}

function Item({ schedule, organizationId }: { schedule: ScheduleItem; organizationId: string }) {
  return (
    <details className={`schedule-item ${schedule.isImportant ? "schedule-item-important" : ""}`} title={schedule.title}>
      <summary className="cursor-pointer list-none font-bold">
        {schedule.isImportant && <Flag className="mr-1 inline" size={11} />}
        {!schedule.isAllDay && `${format(schedule.startsAt, "HH:mm")} `}{schedule.title}
      </summary>
      <div className="mt-2 whitespace-normal rounded-md bg-white/80 p-2 text-xs leading-5 shadow-sm">
        <div className="flex flex-wrap gap-1"><span className="badge badge-gray">{scopeLabel[schedule.scope]}</span><span className="badge badge-gray">{categoryLabel[schedule.category]}</span></div>
        {schedule.description && <p className="mt-2">{schedule.description}</p>}
        <form action={deleteScheduleAction} className="mt-2 no-print">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="scheduleId" value={schedule.id} />
          <button className="btn btn-danger min-h-8 px-2 py-1 text-xs" type="submit"><Trash2 size={12} /> 삭제</button>
        </form>
      </div>
    </details>
  );
}

export function WeekBoard({
  organizationId,
  days,
  departments,
  members,
  schedules,
}: {
  organizationId: string;
  days: Date[];
  departments: Array<{ id: string; name: string }>;
  members: Array<{ userId: string; name: string; departmentId: string }>;
  schedules: ScheduleItem[];
}) {
  const rows: Row[] = [
    { id: "organization", label: "조직 전체", kind: "organization" },
    ...departments.flatMap((department) => [
      { id: `department-${department.id}`, label: department.name, kind: "department" as const, departmentId: department.id },
      ...members.filter((member) => member.departmentId === department.id).map((member) => ({
        id: `member-${member.userId}`, label: `└ ${member.name}`, kind: "member" as const, userId: member.userId, departmentId: department.id,
      })),
    ]),
  ];
  return (
    <div className="schedule-scroll" aria-label="주간 일정표">
      <div className="week-grid">
        <div className="week-cell week-head week-label grid place-items-center font-extrabold">구분</div>
        {days.map((day) => <div key={day.toISOString()} className={`week-cell week-head grid place-items-center ${isToday(day) ? "today" : ""}`}><span className="text-sm font-extrabold">{format(day, "M.d")}</span><span className="muted text-xs">{format(day, "EEE", { locale: ko })}</span></div>)}
        {rows.map((row) => (
          <div key={row.id} className="contents">
            <div className={`week-cell week-label flex items-center font-bold ${row.kind === "member" ? "pl-5 text-sm text-slate-600" : ""}`}>{row.label}</div>
            {days.map((day) => {
              const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day));
              return <div key={`${row.id}-${day.toISOString()}`} className={`week-cell ${isToday(day) ? "today" : ""}`}>{items.slice(0, 3).map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} />)}{items.length > 3 && <span className="muted px-1 text-xs font-bold">+{items.length - 3}개</span>}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthBoard({
  organizationId,
  days,
  currentMonth,
  schedules,
}: {
  organizationId: string;
  days: Date[];
  currentMonth: number;
  schedules: ScheduleItem[];
}) {
  return (
    <div className="schedule-scroll" aria-label="월간 캘린더">
      <div className="month-grid">
        {["월", "화", "수", "목", "금", "토", "일"].map((label) => <div key={label} className="month-cell month-head">{label}</div>)}
        {days.map((day) => {
          const items = schedules.filter((schedule) => occursOnDay(schedule, day));
          return <div key={day.toISOString()} className={`month-cell ${isToday(day) ? "today" : ""} ${day.getMonth() !== currentMonth ? "opacity-45" : ""}`}>
            <p className="mb-2 text-sm font-extrabold">{format(day, "d")}</p>
            {items.slice(0, 3).map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} />)}
            {items.length > 3 && <span className="muted text-xs font-bold">+{items.length - 3}개</span>}
          </div>;
        })}
      </div>
    </div>
  );
}
