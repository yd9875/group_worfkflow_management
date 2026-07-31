import { format, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Flag, Trash2 } from "lucide-react";
import { deleteScheduleAction } from "@/features/actions";
import { SubmitButton } from "@/components/submit-button";

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
  itemType: "SCHEDULE" | "TASK";
  departmentId: string | null;
  departmentName: string | null;
  targetUserId: string | null;
  targetUserName: string | null;
  creatorProfileName: string | null;
};

type Row = {
  id: string;
  label: string;
  kind: "common" | "external" | "leave" | "department";
  departmentId?: string;
};

const categoryLabel: Record<string, string> = {
  GENERAL: "일반",
  MEETING: "회의",
  TRAINING: "교육",
  LEAVE: "휴가",
  BUSINESS_TRIP: "출장",
  OUTING: "외근",
  OTHER: "기타",
};
const externalCategories = new Set(["OUTING", "BUSINESS_TRIP", "TRAINING"]);

function belongsToRow(schedule: ScheduleItem, row: Row) {
  if (schedule.category === "LEAVE") return row.kind === "leave";
  if (externalCategories.has(schedule.category)) return row.kind === "external";
  if (schedule.scope === "ORGANIZATION") return row.kind === "common";
  if (schedule.scope === "DEPARTMENT") return row.kind === "department" && schedule.departmentId === row.departmentId;
  return false;
}

function occursOnDay(schedule: ScheduleItem, day: Date) {
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(24, 0, 0, 0);
  return schedule.startsAt < dayEnd && schedule.endsAt > dayStart;
}

function itemSummary(schedule: ScheduleItem, rowKind?: Row["kind"]) {
  if (rowKind === "leave") return schedule.targetUserName || schedule.creatorProfileName || schedule.title;
  if (rowKind === "external") {
    const name = schedule.targetUserName || schedule.creatorProfileName;
    return `${categoryLabel[schedule.category]}${name ? ` · ${name}` : ""}`;
  }
  if (schedule.itemType === "TASK") return schedule.title;
  return `${!schedule.isAllDay ? `${format(schedule.startsAt, "HH:mm")} ` : ""}${schedule.title}`;
}

function Item({
  schedule,
  organizationId,
  rowKind,
}: {
  schedule: ScheduleItem;
  organizationId: string;
  rowKind?: Row["kind"];
}) {
  return (
    <details className={`schedule-item ${schedule.isImportant ? "schedule-item-important" : ""}`} title={schedule.title}>
      <summary className="cursor-pointer list-none font-bold">
        {schedule.isImportant && <Flag className="mr-1 inline" size={11} />}
        {itemSummary(schedule, rowKind)}
      </summary>
      <div className="mt-2 whitespace-normal rounded-md bg-white/80 p-2 text-xs leading-5 shadow-sm">
        <p className="font-extrabold">{schedule.title}</p>
        {schedule.description && <p className="mt-2">{schedule.description}</p>}
        <p className="mt-2 text-slate-500">등록: {schedule.creatorProfileName || "알 수 없음"}</p>
        <form action={deleteScheduleAction} className="mt-2 no-print">
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="scheduleId" value={schedule.id} />
          <SubmitButton className="btn btn-danger min-h-8 px-2 py-1 text-xs" pendingLabel="삭제 중…"><Trash2 size={12} /> 삭제</SubmitButton>
        </form>
      </div>
    </details>
  );
}

export function WeekBoard({
  organizationId,
  days,
  departments,
  schedules,
}: {
  organizationId: string;
  days: Date[];
  departments: Array<{ id: string; name: string; isSystem: boolean }>;
  schedules: ScheduleItem[];
}) {
  const rows: Row[] = [
    { id: "common", label: "공통사항", kind: "common" },
    ...departments.filter((department) => !department.isSystem).map((department) => ({
      id: `department-${department.id}`,
      label: department.name,
      kind: "department" as const,
      departmentId: department.id,
    })),
    { id: "external", label: "외부 업무", kind: "external" },
    { id: "leave", label: "휴가", kind: "leave" },
  ];
  return (
    <div className="schedule-scroll" aria-label="주간 일정표">
      <div className="week-grid">
        <div className="week-cell week-head week-label grid place-items-center font-extrabold">구분</div>
        {days.map((day) => <div key={day.toISOString()} className={`week-cell week-head grid place-items-center ${isToday(day) ? "today" : ""}`}><span className="text-sm font-extrabold">{format(day, "M.d")}</span><span className="muted text-xs">{format(day, "EEE", { locale: ko })}</span></div>)}
        {rows.map((row) => (
          <div key={row.id} className="contents">
            <div className="week-cell week-label flex items-center font-bold">{row.label}</div>
            {days.map((day) => {
              const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day));
              return <div key={`${row.id}-${day.toISOString()}`} className={`week-cell ${isToday(day) ? "today" : ""}`}>{items.slice(0, 3).map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} rowKind={row.kind} />)}{items.length > 3 && <span className="muted px-1 text-xs font-bold">+{items.length - 3}개</span>}</div>;
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
