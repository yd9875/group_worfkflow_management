"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus2, ClipboardPlus } from "lucide-react";
import { createPersonalEntryAction, updateScheduleAction } from "@/features/actions";
import { SubmitButton } from "@/components/submit-button";

const categoryOptions = [
  ["GENERAL", "일반"],
  ["MEETING", "회의"],
  ["TRAINING", "교육"],
  ["BUSINESS_TRIP", "출장"],
  ["OUTING", "외근"],
  ["OTHER", "기타"],
  ["LEAVE", "휴가"],
] as const;

export type PersonalEntryFormItem = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  memo: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  isImportant: boolean;
  showInWeek: boolean;
  showInMonth: boolean;
  isCompleted: boolean;
  departmentId: string | null;
};

export function PersonalEntryForm({
  organizationId,
  date,
  itemType,
  item,
  closeHref,
  department,
}: {
  organizationId: string;
  date: string;
  itemType: "SCHEDULE" | "TASK";
  item?: PersonalEntryFormItem | null;
  closeHref: string;
  department: { id: string; name: string; isSystem: boolean };
}) {
  const editing = Boolean(item);
  const isTask = itemType === "TASK";
  const [category, setCategory] = useState(item?.category ?? "GENERAL");
  const isLeave = !isTask && category === "LEAVE";
  const formAction = item ? updateScheduleAction : createPersonalEntryAction;

  return (
    <form action={formAction} className={`rounded-2xl border p-5 shadow-sm ${isTask ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTask ? <ClipboardPlus className="text-amber-700" size={19} /> : <CalendarPlus2 className="text-[var(--brand)]" size={19} />}
          <h3 className="font-extrabold">{editing ? `${isTask ? "업무" : "일정"} 수정` : `새 ${isTask ? "업무" : "일정"}`}</h3>
        </div>
        <Link className="btn btn-quiet min-h-8 px-2 py-1 text-xs" href={closeHref}>닫기</Link>
      </div>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="returnDate" value={date} />
      <input type="hidden" name="itemType" value={itemType} />
      {item && <input type="hidden" name="scheduleId" value={item.id} />}
      {isTask && <input type="hidden" name="category" value="GENERAL" />}

      <div className="mt-4 grid gap-4">
        {!isTask && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">유형
              <select className="field" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="label">표시 위치
              <select className="field" name="departmentId" defaultValue={item?.departmentId ?? ""}>
                <option value="">공통사항</option>
                {!department.isSystem && <option value={department.id}>{department.name}</option>}
              </select>
            </label>
          </div>
        )}

        <label className="label">제목<input className="field" name="title" defaultValue={item?.title ?? ""} maxLength={100} required /></label>

        {!isTask && !isLeave && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">시작 일시<input className="field" name="startsAt" type="datetime-local" defaultValue={item?.startsAt ?? `${date}T09:00`} required /></label>
            <label className="label">종료 일시<input className="field" name="endsAt" type="datetime-local" defaultValue={item?.endsAt ?? `${date}T10:00`} required /></label>
          </div>
        )}

        <label className="label">{isTask ? "업무 내용" : "상세 내용"}<textarea className="field min-h-24 resize-y" name="description" defaultValue={item?.description ?? ""} maxLength={2000} placeholder={isTask ? "해야 할 일을 구체적으로 적어주세요." : "장소, 참석자, 준비 사항 등을 적어주세요."} /></label>
        <label className="label">메모<textarea className="field min-h-20 resize-y" name="memo" defaultValue={item?.memo ?? ""} maxLength={4000} placeholder={isTask ? "준비물이나 후속 작업" : "일정과 관련된 개인 메모"} /></label>

        {!isLeave && (
          <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl bg-white/80 p-4 text-sm">
            <label className="flex items-center gap-2"><input className="size-4 accent-[var(--accent)]" type="checkbox" name="isImportant" defaultChecked={item?.isImportant ?? false} /> 중요 {isTask ? "업무" : "일정"}</label>
            <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="showInSchedule" defaultChecked={item ? item.showInWeek || item.showInMonth : true} /> 일정표 표시</label>
            {!isTask && <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isAllDay" defaultChecked={item?.isAllDay ?? false} /> 종일</label>}
            {isTask && <label className="flex items-center gap-2"><input className="size-4 accent-[var(--brand)]" type="checkbox" name="isCompleted" defaultChecked={item?.isCompleted ?? false} /> 업무 완료</label>}
            {!isTask && <input type="hidden" name="isCompleted" value="off" />}
          </div>
        )}

        <div className="flex justify-end"><SubmitButton className="btn btn-primary" pendingLabel="저장 중…">{editing ? "수정 저장" : `${isTask ? "업무" : "일정"} 저장`}</SubmitButton></div>
      </div>
    </form>
  );
}
