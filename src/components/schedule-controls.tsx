"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, Search } from "lucide-react";

export function ScheduleControls({
  organizationId,
  view,
  departments,
}: {
  organizationId: string;
  view: "week" | "month";
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/org/${organizationId}/schedule/${view}?${params.toString()}`);
  }

  return (
    <div className="card no-print flex flex-wrap items-center gap-3 p-3">
      <span className="muted flex items-center gap-2 px-2 text-sm font-bold"><Filter size={16} /> 필터</span>
      <select className="field w-auto min-w-32" value={searchParams.get("department") ?? ""} onChange={(event) => update("department", event.target.value)} aria-label="부서 필터">
        <option value="">모든 부서</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <select className="field w-auto min-w-32" value={searchParams.get("scope") ?? ""} onChange={(event) => update("scope", event.target.value)} aria-label="공유 범위 필터">
        <option value="">모든 범위</option><option value="ORGANIZATION">조직</option><option value="DEPARTMENT">부서</option><option value="PERSONAL">개인</option>
      </select>
      <select className="field w-auto min-w-32" value={searchParams.get("category") ?? ""} onChange={(event) => update("category", event.target.value)} aria-label="분류 필터">
        <option value="">모든 분류</option><option value="GENERAL">일반</option><option value="MEETING">회의</option><option value="TRAINING">교육</option><option value="LEAVE">휴가</option><option value="BUSINESS_TRIP">출장</option><option value="OUTING">외출</option><option value="OTHER">기타</option>
      </select>
      <label className="relative ml-auto min-w-48 flex-1 sm:max-w-xs">
        <Search className="muted absolute left-3 top-1/2 -translate-y-1/2" size={16} />
        <input
          className="field pl-9"
          type="search"
          placeholder="제목·설명 검색"
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(event) => {
            if (event.key === "Enter") update("q", event.currentTarget.value);
          }}
          aria-label="일정 검색"
        />
      </label>
      <label className="flex items-center gap-2 px-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={searchParams.get("important") === "1"} onChange={(event) => update("important", event.target.checked ? "1" : "")} />
        중요만
      </label>
    </div>
  );
}
