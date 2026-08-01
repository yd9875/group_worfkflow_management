"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

function parseDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function DatePickerNavigation({
  basePath,
  date,
  label,
  query = {},
}: {
  basePath: string;
  date: string;
  label: string;
  query?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDate(date);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate));
  const calendarStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectDate(nextDate: Date) {
    const params = new URLSearchParams();
    params.set("date", format(nextDate, "yyyy-MM-dd"));
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setOpen(false);
    router.push(`${basePath}?${params.toString()}`);
  }

  function toggleCalendar() {
    if (!open) setVisibleMonth(startOfMonth(selectedDate));
    setOpen(!open);
  }

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-bold text-slate-600 transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]"
        type="button"
        onClick={toggleCalendar}
      >
        <CalendarDays size={15} /> {label}
      </button>
      {open && (
        <div aria-label="날짜 선택 달력" className="absolute left-1/2 top-[calc(100%+.5rem)] z-50 w-[19rem] -translate-x-1/2 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl" role="dialog">
          <div className="flex items-center justify-between gap-3">
            <button aria-label="이전 달" className="period-arrow" type="button" onClick={() => setVisibleMonth((month) => addMonths(month, -1))}><ChevronLeft size={18} /></button>
            <p className="font-extrabold">{format(visibleMonth, "yyyy년 M월")}</p>
            <button aria-label="다음 달" className="period-arrow" type="button" onClick={() => setVisibleMonth((month) => addMonths(month, 1))}><ChevronRight size={18} /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-xs font-bold text-slate-500">
            {["월", "화", "수", "목", "금", "토", "일"].map((weekday) => <span className="py-1.5" key={weekday}>{weekday}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              return (
                <button
                  aria-label={format(day, "yyyy년 M월 d일")}
                  aria-pressed={selected}
                  className={`grid aspect-square place-items-center rounded-lg text-sm font-bold transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)] ${selected ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)] hover:text-white" : ""} ${!isSameMonth(day, visibleMonth) ? "text-slate-300" : ""}`}
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDate(day)}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
