import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type SchedulePeriodView = "day" | "week" | "month";

export function getScheduleRange(date: Date, view: SchedulePeriodView, dayCount = 1) {
  if (view === "day") {
    const safeDayCount = Math.max(1, Math.min(dayCount, 7));
    return {
      start: startOfDay(date),
      end: endOfDay(addDays(date, safeDayCount - 1)),
    };
  }

  if (view === "week") {
    return {
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
    };
  }

  return {
    start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
  };
}

export function getReportRange(date: Date, view: SchedulePeriodView) {
  if (view === "day") {
    const start = startOfDay(date);
    return { start, end: addDays(start, 1) };
  }

  if (view === "week") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return { start, end: addWeeks(start, 1) };
  }

  const start = startOfMonth(date);
  return { start, end: addMonths(start, 1) };
}

export function getReferenceRange(date: Date, view: SchedulePeriodView) {
  if (view === "day") {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    return { start, end: addWeeks(start, 2) };
  }

  if (view === "week") {
    const start = addWeeks(startOfWeek(date, { weekStartsOn: 1 }), 1);
    return { start, end: addWeeks(start, 4) };
  }

  const nextMonth = addMonths(date, 1);
  return {
    start: startOfWeek(startOfMonth(nextMonth), { weekStartsOn: 1 }),
    end: addDays(endOfWeek(endOfMonth(nextMonth), { weekStartsOn: 1 }), 1),
  };
}
