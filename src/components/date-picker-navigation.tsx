"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

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

  return (
    <label className="relative min-w-0 cursor-pointer rounded-lg px-2 py-1 font-bold text-slate-600 hover:bg-[var(--brand-soft)] hover:text-[var(--brand-strong)]">
      <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> {label}</span>
      <input
        aria-label="날짜 선택"
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        type="date"
        value={date}
        onChange={(event) => {
          if (!event.target.value) return;
          const params = new URLSearchParams();
          params.set("date", event.target.value);
          Object.entries(query).forEach(([key, value]) => {
            if (value) params.set(key, value);
          });
          router.push(`${basePath}?${params.toString()}`);
        }}
      />
    </label>
  );
}
