import Link from "next/link";
import { format, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { CheckCircle2, Clock3, Flag, Pencil, Trash2 } from "lucide-react";
import { deleteScheduleAction, toggleTaskCompleteAction } from "@/features/actions";
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
  showInWeek: boolean;
  showInMonth: boolean;
  isCompleted: boolean;
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
  kind: "common" | "external" | "leave" | "department" | "personal";
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
  if (schedule.scope === "PERSONAL") {
    return schedule.departmentId
      ? row.kind === "department" && schedule.departmentId === row.departmentId
      : row.kind === "common";
  }
  if (schedule.scope === "ORGANIZATION") return row.kind === "common";
  return schedule.scope === "DEPARTMENT" && row.kind === "department" && schedule.departmentId === row.departmentId;
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
  return schedule.itemType === "TASK"
    ? schedule.title
    : `${!schedule.isAllDay ? `${format(schedule.startsAt, "HH:mm")} ` : ""}${schedule.title}`;
}

function Item({
  schedule,
  organizationId,
  rowKind,
  showCreator = false,
  readOnly = false,
}: {
  schedule: ScheduleItem;
  organizationId: string;
  rowKind?: Row["kind"];
  showCreator?: boolean;
  readOnly?: boolean;
}) {
  const shouldShowCreator = showCreator && rowKind !== "leave" && rowKind !== "external" && schedule.creatorProfileName;
  return (
    <details className={`schedule-item ${schedule.isImportant ? "schedule-item-important" : ""} ${schedule.isCompleted ? "schedule-item-completed" : ""}`} title={schedule.title}>
      <summary className="cursor-pointer list-none font-bold">
        {schedule.isImportant && <Flag className="mr-1 inline" size={11} />}
        {itemSummary(schedule, rowKind)}
        {shouldShowCreator && <span className="mt-0.5 block text-[10px] font-medium text-slate-500">{schedule.creatorProfileName}</span>}
      </summary>
      <div className="mt-2 whitespace-normal rounded-md bg-white/80 p-2 text-xs leading-5 shadow-sm">
        <p className="font-extrabold">{schedule.title}</p>
        <p className="mt-1 text-slate-500">
          {categoryLabel[schedule.category] ?? schedule.category}
          {schedule.category !== "LEAVE" && schedule.itemType !== "TASK" && <> · {schedule.isAllDay ? "종일" : `${format(schedule.startsAt, "HH:mm")}–${format(schedule.endsAt, "HH:mm")}`}</>}
        </p>
        {schedule.description && <p className="mt-2">{schedule.description}</p>}
        <p className="mt-2 text-slate-500">등록: {schedule.creatorProfileName || "알 수 없음"}</p>
        {!readOnly && <div className="schedule-item-actions no-print">
          <Link aria-label={`${schedule.title} 수정`} className="btn btn-secondary schedule-action-btn" title="수정" href={`/org/${organizationId}/personal?date=${format(schedule.startsAt, "yyyy-MM-dd")}&edit=${schedule.id}`}><Pencil /></Link>
          <form action={deleteScheduleAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="scheduleId" value={schedule.id} />
            <SubmitButton aria-label={`${schedule.title} 삭제`} className="btn btn-danger schedule-action-btn" title="삭제" pendingLabel="…"><Trash2 /></SubmitButton>
          </form>
        </div>}
      </div>
    </details>
  );
}

export function WeekBoard({ organizationId, days, departments, schedules, readOnly = false }: { organizationId: string; days: Date[]; departments: Array<{ id: string; name: string; isSystem: boolean }>; schedules: ScheduleItem[]; readOnly?: boolean }) {
  const rows: Row[] = [
    { id: "common", label: "공통사항", kind: "common" },
    ...departments.filter((department) => !department.isSystem).map((department) => ({ id: `department-${department.id}`, label: department.name, kind: "department" as const, departmentId: department.id })),
    { id: "external", label: "외부 일정", kind: "external" },
    { id: "leave", label: "휴가", kind: "leave" },
  ];
  return (
    <div className="schedule-scroll" aria-label="주간 일정표">
      <div className="week-grid">
        <div className="week-cell week-head week-label grid place-items-center font-extrabold">구분</div>
        {days.map((day) => <div key={day.toISOString()} className={`week-cell week-head grid place-items-center ${isToday(day) ? "today" : ""}`}><span className="text-sm font-extrabold">{format(day, "M.d")}</span><span className="muted text-xs">{format(day, "EEE", { locale: ko })}</span></div>)}
        {rows.map((row) => <div key={row.id} className="contents"><div className="week-cell week-label flex items-center font-bold">{row.label}</div>{days.map((day) => { const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day)); return <div key={`${row.id}-${day.toISOString()}`} className={`week-cell ${isToday(day) ? "today" : ""}`}>{items.map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} rowKind={row.kind} showCreator readOnly={readOnly} />)}</div>; })}</div>)}
      </div>
    </div>
  );
}

export function MonthBoard({ organizationId, days, currentMonth, schedules, readOnly = false }: { organizationId: string; days: Date[]; currentMonth?: number; schedules: ScheduleItem[]; readOnly?: boolean }) {
  return (
    <div className="schedule-scroll" aria-label="월간 캘린더"><div className="month-grid">
      {["월", "화", "수", "목", "금", "토", "일"].map((label) => <div key={label} className="month-cell month-head">{label}</div>)}
      {days.map((day) => { const items = schedules.filter((schedule) => occursOnDay(schedule, day)); return <div key={day.toISOString()} className={`month-cell ${isToday(day) ? "today" : ""} ${currentMonth !== undefined && day.getMonth() !== currentMonth ? "opacity-45" : ""}`}><p className="mb-2 text-sm font-extrabold">{format(day, "d")}</p>{items.map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} readOnly={readOnly} />)}</div>; })}
    </div></div>
  );
}

export function DayBoard({ organizationId, days, departments, schedules }: {
  organizationId: string;
  days: Date[];
  departments: Array<{ id: string; name: string; isSystem: boolean }>;
  schedules: ScheduleItem[];
}) {
  const rows: Row[] = [
    { id: "common", label: "공통사항", kind: "common" },
    ...departments.filter((department) => !department.isSystem).map((department) => ({ id: `department-${department.id}`, label: department.name, kind: "department" as const, departmentId: department.id })),
    { id: "external", label: "외부 일정", kind: "external" },
    { id: "leave", label: "휴가", kind: "leave" },
  ];

  return (
    <div className="schedule-scroll" aria-label="일일 계획표">
      <div className={`day-grid ${days.length === 1 ? "day-grid-single" : ""}`}>
        <div className="day-cell day-head day-label grid place-items-center font-extrabold">구분</div>
        {days.map((day) => (
          <div key={day.toISOString()} className={`day-cell day-head flex items-center justify-center gap-3 ${isToday(day) ? "today" : ""}`}><span className="text-lg font-extrabold">{format(day, "M.d")}</span><span className="muted text-sm font-bold">{format(day, "EEEE", { locale: ko })}</span></div>
        ))}
        {rows.map((row) => {
          return (
            <div className="contents" key={row.id}>
              <div className="day-cell day-label flex items-start pt-5 font-bold">{row.label}</div>
              {days.map((day) => {
                const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day));
                return <div key={`${row.id}-${day.toISOString()}`} className={`day-cell grid content-start gap-3 ${isToday(day) ? "today" : ""}`}>
                {row.kind === "leave" ? items.map((schedule) => (
                  <Item key={schedule.id} schedule={schedule} organizationId={organizationId} rowKind="leave" />
                )) : items.map((schedule) => (
                  <details className={`day-schedule-card rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm ${schedule.isCompleted ? "opacity-60" : ""}`} key={schedule.id}>
                    <summary className="day-schedule-summary cursor-pointer list-none">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="badge badge-green">{schedule.itemType === "TASK" ? "업무" : categoryLabel[schedule.category] ?? schedule.category}</span>
                          <h2 className={`text-lg font-extrabold ${schedule.isCompleted ? "line-through" : ""}`}>{schedule.title}</h2>
                          <span className="muted flex flex-wrap items-center gap-2 text-sm">
                            {schedule.itemType !== "TASK" && <><Clock3 size={15} /> {schedule.isAllDay ? "종일" : `${format(schedule.startsAt, "HH:mm")} – ${format(schedule.endsAt, "HH:mm")}`}<span>·</span></>}
                            <span>{schedule.targetUserName || schedule.creatorProfileName || "담당자 없음"}</span>
                          </span>
                          {schedule.isImportant && <span className="badge badge-orange"><Flag size={12} /> 중요</span>}
                          {schedule.isCompleted && <span className="badge badge-green"><CheckCircle2 size={12} /> 완료</span>}
                        </div>
                        {schedule.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{schedule.description}</p>}
                      </div>
                    </summary>
                    <div className="day-schedule-actions no-print">
                      {schedule.itemType === "TASK" && <form action={toggleTaskCompleteAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="scheduleId" value={schedule.id} /><input type="hidden" name="nextCompleted" value={schedule.isCompleted ? "false" : "true"} /><input type="hidden" name="returnView" value="day" /><SubmitButton aria-label={schedule.isCompleted ? `${schedule.title} 미완료로 변경` : `${schedule.title} 완료 처리`} className="btn btn-secondary schedule-action-btn" title={schedule.isCompleted ? "미완료로" : "완료"} pendingLabel="…"><CheckCircle2 /></SubmitButton></form>}
                      <Link aria-label={`${schedule.title} 수정`} className="btn btn-secondary schedule-action-btn" title="수정" href={`/org/${organizationId}/personal?date=${format(schedule.startsAt, "yyyy-MM-dd")}&edit=${schedule.id}`}><Pencil /></Link>
                      <form action={deleteScheduleAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="scheduleId" value={schedule.id} /><SubmitButton aria-label={`${schedule.title} 삭제`} className="btn btn-danger schedule-action-btn" title="삭제" pendingLabel="…"><Trash2 /></SubmitButton></form>
                    </div>
                  </details>
                ))}
                {!items.length && <p className="muted py-5 text-center text-sm">등록된 항목이 없습니다.</p>}
                </div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
