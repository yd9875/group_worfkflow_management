"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createScheduleAction } from "@/features/actions";
import { SubmitButton } from "@/components/submit-button";

type Option = { id: string; name: string };

export function ScheduleDialog({
  organizationId,
  departments,
  defaultDate,
  openInitially = false,
}: {
  organizationId: string;
  departments: Option[];
  defaultDate: string;
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(openInitially);
  const [scope, setScope] = useState("ORGANIZATION");
  const [category, setCategory] = useState("GENERAL");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const start = `${defaultDate}T09:00`;
  const end = `${defaultDate}T10:00`;
  const hideScope = category === "OUTING" || category === "LEAVE";

  function close() {
    setOpen(false);
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }

  const [formError, formAction] = useActionState(
    async (_previous: string | null, formData: FormData) => {
      try {
        await createScheduleAction(formData);
        close();
        return null;
      } catch {
        return "일정을 등록하지 못했습니다. 입력값과 권한을 확인해 주세요.";
      }
    },
    null,
  );

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        <Plus size={17} /> 일정 추가
      </button>
      {open && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) close();
        }}>
          <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">New schedule</p>
                <h2 id="schedule-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-.035em]">새 일정 등록</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-lg hover:bg-slate-100" type="button" onClick={close} aria-label="닫기"><X size={20} /></button>
            </header>
            <form className="mt-6 grid gap-4" action={formAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="label">제목<input className="field" name="title" maxLength={100} required autoFocus /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">시작<input className="field" name="startsAt" type="datetime-local" defaultValue={start} required /></label>
                <label className="label">종료<input className="field" name="endsAt" type="datetime-local" defaultValue={end} required /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {!hideScope && (
                  <label className="label">표시 위치
                    <select className="field" name="scope" value={scope} onChange={(event) => setScope(event.target.value)}>
                      <option value="ORGANIZATION">공통사항</option>
                      <option value="DEPARTMENT">부서</option>
                    </select>
                  </label>
                )}
                <label className="label">분류
                  <select className="field" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="GENERAL">일반</option><option value="MEETING">회의</option><option value="TRAINING">교육</option>
                    <option value="LEAVE">휴가</option><option value="BUSINESS_TRIP">출장</option><option value="OUTING">외근</option><option value="OTHER">기타</option>
                  </select>
                </label>
              </div>
              {!hideScope && scope === "DEPARTMENT" && (
                <label className="label">대상 부서
                  <select className="field" name="departmentId" required>
                    <option value="">선택하세요</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
              )}
              <label className="label">설명<textarea className="field" name="description" maxLength={2000} /></label>
              {formError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</p>}
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="isAllDay" className="size-4 accent-[var(--brand)]" /> 종일 일정</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="isImportant" className="size-4 accent-[var(--accent)]" /> 중요 일정</label>
              </div>
              <footer className="mt-2 flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={close}>취소</button>
                <SubmitButton className="btn btn-primary" pendingLabel="등록 중…">일정 등록</SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
