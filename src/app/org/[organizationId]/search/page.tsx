import Link from "next/link";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Flag, Search, SlidersHorizontal } from "lucide-react";
import { getScheduleContext, searchSchedules } from "@/features/queries";
import { SubmitButton } from "@/components/submit-button";

type SearchValue = string | string[] | undefined;

const categoryOptions = [
  ["GENERAL", "일반"],
  ["MEETING", "회의"],
  ["TRAINING", "교육"],
  ["BUSINESS_TRIP", "출장"],
  ["OUTING", "외근"],
  ["OTHER", "기타"],
  ["LEAVE", "휴가"],
  ["TASK", "업무"],
] as const;

const categoryLabel: Record<string, string> = Object.fromEntries(categoryOptions);

function one(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: SearchValue) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export default async function ScheduleSearchPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  const query = one(search.q)?.trim().slice(0, 100) ?? "";
  const selectedCategories = many(search.category);
  const department = one(search.department);
  const member = one(search.member);
  const today = toZonedTime(new Date(), "Asia/Seoul");
  const defaultStartsOn = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultEndsOn = format(endOfMonth(today), "yyyy-MM-dd");
  const requestedStartsOn = one(search.startsOn);
  const requestedEndsOn = one(search.endsOn);
  const startsOn = requestedStartsOn && /^\d{4}-\d{2}-\d{2}$/.test(requestedStartsOn) ? requestedStartsOn : defaultStartsOn;
  const candidateEndsOn = requestedEndsOn && /^\d{4}-\d{2}-\d{2}$/.test(requestedEndsOn) ? requestedEndsOn : defaultEndsOn;
  const endsOn = candidateEndsOn >= startsOn ? candidateEndsOn : startsOn;
  const rangeStart = new Date(`${startsOn}T00:00:00+09:00`);
  const rangeEnd = addDays(new Date(`${endsOn}T00:00:00+09:00`), 1);
  const [context, schedules] = await Promise.all([
    getScheduleContext(organizationId),
    query
      ? searchSchedules({
          organizationId,
          query,
          categories: selectedCategories,
          departmentId: department,
          memberId: member,
          rangeStart,
          rangeEnd,
        })
      : Promise.resolve([]),
  ]);
  const profileNames = new Map(context.members.map((item) => [item.userId, item.profileName?.trim() || item.user.name]));
  const grouped = schedules.reduce<Map<string, typeof schedules>>((groups, schedule) => {
    const key = format(schedule.startsAt, "yyyy-MM-dd");
    const items = groups.get(key) ?? [];
    items.push(schedule);
    groups.set(key, items);
    return groups;
  }, new Map());
  const resetParams = new URLSearchParams();
  if (query) resetParams.set("q", query);

  return (
    <div className="grid gap-5">
      <header>
        <p className="eyebrow flex items-center gap-2"><Search size={15} /> Schedule search</p>
        <h1 className="page-title mt-1">일정 및 업무 검색</h1>
        <p className="muted mt-2">제목과 내용에서 검색하고 날짜별로 결과를 확인합니다.</p>
      </header>

      <form method="get" action={`/org/${organizationId}/search`} className="card grid gap-4 p-5">
        <label className="label">
          검색어
          <span className="mt-2 flex flex-col gap-2 sm:flex-row">
            <span className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="field pl-10" type="search" name="q" defaultValue={query} maxLength={100} placeholder="일정 또는 업무 제목·내용 검색" required />
            </span>
            <SubmitButton className="btn btn-primary" pendingLabel="검색 중…"><Search size={17} /> 검색</SubmitButton>
          </span>
        </label>

        <fieldset>
          <legend className="label flex items-center gap-2"><SlidersHorizontal className="text-[var(--brand)]" size={18} /> 일정 유형</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            {categoryOptions.map(([value, label]) => (
              <label className="flex items-center gap-2" key={value}>
                <input className="size-4 accent-[var(--brand)]" type="checkbox" name="category" value={value} defaultChecked={selectedCategories.includes(value)} /> {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          <label className="label min-w-40 flex-1">검색 시작일<input className="field" type="date" name="startsOn" defaultValue={startsOn} /></label>
          <label className="label min-w-40 flex-1">검색 종료일<input className="field" type="date" name="endsOn" defaultValue={endsOn} /></label>
          <label className="label min-w-36 flex-1">부서<select className="field" name="department" defaultValue={department ?? ""}><option value="">전체 부서</option>{context.departments.filter((item) => !item.isSystem).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="label min-w-36 flex-1">구성원<select className="field" name="member" defaultValue={member ?? ""}><option value="">전체 구성원</option>{context.members.map((item) => <option key={item.userId} value={item.userId}>{item.profileName?.trim() || item.user.name}</option>)}</select></label>
          <SubmitButton className="btn btn-secondary" pendingLabel="필터 적용 중…">필터 적용</SubmitButton>
          <Link className="btn btn-quiet" href={`/org/${organizationId}/search?${resetParams.toString()}`}>필터 초기화</Link>
        </div>
      </form>

      {query ? (
        <section className="grid gap-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">‘{query}’ 검색 결과</h2>
            <p className="muted text-sm">{startsOn} – {endsOn} · {schedules.length}개 항목 · {grouped.size}개 날짜</p>
          </div>
          {[...grouped.entries()].map(([date, items]) => (
            <article className="card overflow-hidden" key={date}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-slate-50 px-5 py-3">
                <h3 className="font-extrabold">{format(new Date(`${date}T12:00:00`), "yyyy년 M월 d일 EEEE", { locale: ko })}</h3>
                <Link className="btn btn-quiet min-h-8 px-2 py-1 text-xs" href={`/org/${organizationId}/schedule/day?date=${date}`}>일일 계획 보기 <ArrowRight size={14} /></Link>
              </header>
              <div className="divide-y divide-[var(--line)]">
                {items.map((item) => {
                  const ownerName = item.targetUserId
                    ? profileNames.get(item.targetUserId) ?? item.targetUser?.name
                    : item.createdByUserId
                      ? profileNames.get(item.createdByUserId) ?? item.createdBy?.name
                      : null;
                  return (
                    <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" key={item.id}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-green">{item.itemType === "TASK" ? "업무" : categoryLabel[item.category] ?? item.category}</span>
                          <h4 className={`font-extrabold ${item.isCompleted ? "line-through opacity-60" : ""}`}>{item.isImportant && <Flag className="mr-1 inline text-[var(--accent)]" size={14} />}{item.title}</h4>
                          {item.itemType === "TASK" && <span className={`badge ${item.isCompleted ? "badge-green" : "badge-gray"}`}><CheckCircle2 size={12} /> {item.isCompleted ? "완료" : "진행"}</span>}
                        </div>
                        <p className="muted mt-2 flex flex-wrap items-center gap-2 text-sm">
                          {item.itemType !== "TASK" && <><Clock3 size={14} /> {item.isAllDay ? "종일" : `${format(item.startsAt, "M.d HH:mm")} – ${format(item.endsAt, "M.d HH:mm")}`}<span>·</span></>}
                          {ownerName && <span>{ownerName}</span>}
                          {item.department?.name && <><span>·</span><span>{item.department.name}</span></>}
                        </p>
                        {item.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.description}</p>}
                      </div>
                      <Link className="btn btn-secondary min-h-8 px-3 py-1 text-xs" href={`/org/${organizationId}/personal?date=${date}&edit=${item.id}`}>상세/수정</Link>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
          {!schedules.length && <div className="card p-10 text-center"><CalendarDays className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-extrabold">검색 결과가 없습니다</p><p className="muted mt-1 text-sm">검색어나 필터를 바꿔 다시 확인해 보세요.</p></div>}
          {schedules.length === 500 && <p className="muted text-center text-xs">최대 500개 결과까지 표시됩니다. 검색어나 필터를 더 구체적으로 입력해 주세요.</p>}
        </section>
      ) : (
        <div className="card p-10 text-center"><Search className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-extrabold">검색어를 입력해 주세요</p><p className="muted mt-1 text-sm">검색 결과는 일정이 시작되는 날짜별로 묶어서 표시됩니다.</p></div>
      )}
    </div>
  );
}
