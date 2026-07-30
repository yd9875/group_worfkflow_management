"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createScheduleAction } from "@/features/actions";

type Option = { id: string; name: string };

export function ScheduleDialog({
  organizationId,
  departments,
  members,
  defaultDate,
  openInitially = false,
}: {
  organizationId: string;
  departments: Option[];
  members: Option[];
  defaultDate: string;
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(openInitially);
  const [scope, setScope] = useState("PERSONAL");
  const start = `${defaultDate}T09:00`;
  const end = `${defaultDate}T10:00`;

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        <Plus size={17} /> 일정 추가
      </button>
      {open && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">New schedule</p>
                <h2 id="schedule-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-.035em]">새 일정 등록</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-lg hover:bg-slate-100" type="button" onClick={() => setOpen(false)} aria-label="닫기"><X size={20} /></button>
            </header>
            <form className="mt-6 grid gap-4" action={createScheduleAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="label">제목<input className="field" name="title" maxLength={100} required autoFocus /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">시작<input className="field" name="startsAt" type="datetime-local" defaultValue={start} required /></label>
                <label className="label">종료<input className="field" name="endsAt" type="datetime-local" defaultValue={end} required /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">공유 범위
                  <select className="field" name="scope" value={scope} onChange={(event) => setScope(event.target.value)}>
                    <option value="ORGANIZATION">조직 전체</option>
                    <option value="DEPARTMENT">부서</option>
                    <option value="PERSONAL">개인</option>
                  </select>
                </label>
                <label className="label">분류
                  <select className="field" name="category" defaultValue="GENERAL">
                    <option value="GENERAL">일반</option><option value="MEETING">회의</option><option value="TRAINING">교육</option>
                    <option value="LEAVE">휴가</option><option value="BUSINESS_TRIP">출장</option><option value="OUTING">외출</option><option value="OTHER">기타</option>
                  </select>
                </label>
              </div>
              {scope === "DEPARTMENT" && (
                <label className="label">대상 부서
                  <select className="field" name="departmentId" required>
                    <option value="">선택하세요</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
              )}
              {scope === "PERSONAL" && (
                <label className="label">대상 구성원
                  <select className="field" name="targetUserId" required>
                    <option value="">선택하세요</option>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              )}
              <label className="label">설명<textarea className="field" name="description" maxLength={2000} /></label>
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="isAllDay" className="size-4 accent-[var(--brand)]" /> 종일 일정</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isImportant" className="size-4 accent-[var(--accent)]" /> 중요 일정</label>
              </div>
              <footer className="mt-2 flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>취소</button>
                <button type="submit" className="btn btn-primary">일정 등록</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
