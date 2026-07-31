"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardPlus, X } from "lucide-react";
import { createTaskAction } from "@/features/actions";
import { SubmitButton } from "@/components/submit-button";

export function TaskDialog({
  organizationId,
  defaultDate,
  openInitially = false,
}: {
  organizationId: string;
  defaultDate: string;
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(openInitially);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function close() {
    setOpen(false);
    if (searchParams.has("new")) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>
        <ClipboardPlus size={17} /> 업무 추가
      </button>
      {open && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">New task</p>
                <h2 id="task-dialog-title" className="mt-1 text-2xl font-extrabold tracking-[-.035em]">새 업무 등록</h2>
              </div>
              <button className="grid size-10 place-items-center rounded-lg hover:bg-slate-100" type="button" onClick={close} aria-label="닫기">
                <X size={20} />
              </button>
            </header>
            <form className="mt-6 grid gap-4" action={createTaskAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <label className="label">업무명<input className="field" name="title" maxLength={100} required autoFocus /></label>
              <label className="label">날짜<input className="field" name="date" type="date" defaultValue={defaultDate} required /></label>
              <label className="label">설명<textarea className="field" name="description" maxLength={2000} /></label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isImportant" className="size-4 accent-[var(--accent)]" /> 중요 업무
              </label>
              <footer className="mt-2 flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={close}>취소</button>
                <SubmitButton className="btn btn-primary" pendingLabel="등록 중…">업무 등록</SubmitButton>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
