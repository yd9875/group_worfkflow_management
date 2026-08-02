import Link from "next/link";
import { format, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { CheckCircle2, Clock3, Flag, Pencil, StickyNote, Trash2 } from "lucide-react";
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
  memo: string | null;
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
}: {
  schedule: ScheduleItem;
  organizationId: string;
  rowKind?: Row["kind"];
  showCreator?: boolean;
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
        <p className="mt-1 text-slate-500">{categoryLabel[schedule.category] ?? schedule.category} · {schedule.isAllDay ? "종일" : `${format(schedule.startsAt, "HH:mm")}–${format(schedule.endsAt, "HH:mm")}`}</p>
        {schedule.description && <p className="mt-2">{schedule.description}</p>}
        {schedule.scope !== "PERSONAL" && schedule.memo && <p className="mt-2 flex items-start gap-1 text-slate-600"><StickyNote className="mt-0.5 shrink-0" size={12} /> {schedule.memo}</p>}
        <p className="mt-2 text-slate-500">등록: {schedule.creatorProfileName || "알 수 없음"}</p>
        <div className="mt-2 flex flex-wrap gap-2 no-print">
          <Link className="btn btn-secondary min-h-8 px-2 py-1 text-xs" href={`/org/${organizationId}/personal?date=${format(schedule.startsAt, "yyyy-MM-dd")}&edit=${schedule.id}`}><Pencil size={12} /> 수정</Link>
          <form action={deleteScheduleAction}>
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="scheduleId" value={schedule.id} />
            <SubmitButton className="btn btn-danger min-h-8 px-2 py-1 text-xs" pendingLabel="삭제 중…"><Trash2 size={12} /> 삭제</SubmitButton>
          </form>
        </div>
      </div>
    </details>
  );
}

export function WeekBoard({ organizationId, days, departments, schedules }: { organizationId: string; days: Date[]; departments: Array<{ id: string; name: string; isSystem: boolean }>; schedules: ScheduleItem[] }) {
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
        {rows.map((row) => <div key={row.id} className="contents"><div className="week-cell week-label flex items-center font-bold">{row.label}</div>{days.map((day) => { const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day)); return <div key={`${row.id}-${day.toISOString()}`} className={`week-cell ${isToday(day) ? "today" : ""}`}>{items.map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} rowKind={row.kind} showCreator />)}</div>; })}</div>)}
      </div>
    </div>
  );
}

export function MonthBoard({ organizationId, days, currentMonth, schedules }: { organizationId: string; days: Date[]; currentMonth: number; schedules: ScheduleItem[] }) {
  return (
    <div className="schedule-scroll" aria-label="월간 캘린더"><div className="month-grid">
      {["월", "화", "수", "목", "금", "토", "일"].map((label) => <div key={label} className="month-cell month-head">{label}</div>)}
      {days.map((day) => { const items = schedules.filter((schedule) => occursOnDay(schedule, day)); return <div key={day.toISOString()} className={`month-cell ${isToday(day) ? "today" : ""} ${day.getMonth() !== currentMonth ? "opacity-45" : ""}`}><p className="mb-2 text-sm font-extrabold">{format(day, "d")}</p>{items.map((schedule) => <Item key={schedule.id} schedule={schedule} organizationId={organizationId} />)}</div>; })}
    </div></div>
  );
}

export function DayBoard({ organizationId, day, departments, schedules }: {
  organizationId: string;
  day: Date;
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
      <div className="day-grid">
        <div className="day-cell day-head day-label grid place-items-center font-extrabold">구분</div>
        <div className={`day-cell day-head flex items-center justify-center gap-3 ${isToday(day) ? "today" : ""}`}><span className="text-lg font-extrabold">{format(day, "M.d")}</span><span className="muted text-sm font-bold">{format(day, "EEEE", { locale: ko })}</span></div>
        {rows.map((row) => {
          const items = schedules.filter((schedule) => belongsToRow(schedule, row) && occursOnDay(schedule, day));
          return (
            <div className="contents" key={row.id}>
              <div className="day-cell day-label flex items-start pt-5 font-bold">{row.label}</div>
              <div className={`day-cell grid gap-3 ${isToday(day) ? "today" : ""}`}>
                {row.kind === "leave" ? items.map((schedule) => (
                  <Item key={schedule.id} schedule={schedule} organizationId={organizationId} rowKind="leave" />
                )) : items.map((schedule) => (
                  <article className={`rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm ${schedule.isCompleted ? "opacity-60" : ""}`} key={schedule.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="badge badge-green">{schedule.itemType === "TASK" ? "업무" : categoryLabel[schedule.category] ?? schedule.category}</span>
                          <h2 className={`text-lg font-extrabold ${schedule.isCompleted ? "line-through" : ""}`}>{schedule.title}</h2>
                          <span className="muted flex flex-wrap items-center gap-2 text-sm"><Clock3 size={15} /> {schedule.isAllDay ? "종일" : `${format(schedule.startsAt, "HH:mm")} – ${format(schedule.endsAt, "HH:mm")}`}<span>·</span><span>{schedule.targetUserName || schedule.creatorProfileName || "담당자 없음"}</span></span>
                          {schedule.departmentName && <span className="badge badge-gray">{schedule.departmentName}</span>}
                          {schedule.isImportant && <span className="badge badge-orange"><Flag size={12} /> 중요</span>}
                          {schedule.isCompleted && <span className="badge badge-green"><CheckCircle2 size={12} /> 완료</span>}
                        </div>
                        {schedule.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{schedule.description}</p>}
                        {schedule.scope !== "PERSONAL" && schedule.memo && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"><StickyNote className="mr-2 inline" size={15} />{schedule.memo}</div>}
                      </div>
                      <div className="flex flex-wrap gap-2 no-print">
                        {schedule.itemType === "TASK" && <form action={toggleTaskCompleteAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="scheduleId" value={schedule.id} /><input type="hidden" name="nextCompleted" value={schedule.isCompleted ? "false" : "true"} /><input type="hidden" name="returnView" value="day" /><SubmitButton className="btn btn-secondary" pendingLabel="변경 중…"><CheckCircle2 size={16} /> {schedule.isCompleted ? "미완료로" : "완료"}</SubmitButton></form>}
                        <Link className="btn btn-secondary" href={`/org/${organizationId}/personal?date=${format(schedule.startsAt, "yyyy-MM-dd")}&edit=${schedule.id}`}><Pencil size={16} /> 수정</Link>
                        <form action={deleteScheduleAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="scheduleId" value={schedule.id} /><SubmitButton className="btn btn-danger" pendingLabel="삭제 중…"><Trash2 size={16} /> 삭제</SubmitButton></form>
                      </div>
                    </div>
                  </article>
                ))}
                {!items.length && <p className="muted py-5 text-center text-sm">등록된 항목이 없습니다.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
