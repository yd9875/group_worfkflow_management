import Link from "next/link";
import { Building2, CalendarDays, Plus, UserRoundCog, UserRoundPlus } from "lucide-react";
import {
  createOrganizationAction,
  requestJoinAction,
} from "@/features/actions";
import { listMyOrganizations } from "@/features/queries";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/sign-out-button";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const user = await requireUser();
  const organizations = await listMyOrganizations();
  const pending = await prisma.joinRequest.findMany({
    where: { userId: user.id, status: "PENDING" },
    select: {
      id: true,
      organization: { select: { name: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[var(--brand)] text-white"><CalendarDays size={21} /></span>
          <div><p className="font-extrabold">조직 일정 관리</p><p className="muted text-sm">{user.name} 님</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link className="btn btn-secondary" href="/account"><UserRoundCog size={17} /> 계정 설정</Link>
          <div className="w-32"><SignOutButton /></div>
        </div>
      </header>

      <section>
        <p className="eyebrow">My organizations</p>
        <h1 className="page-title mt-2">어느 조직의 일정을 볼까요?</h1>
        <p className="muted mt-3">조직을 선택하거나 새로운 조직을 만들 수 있습니다.</p>

        {organizations.length ? (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((membership) => (
              <Link key={membership.id} href={`/org/${membership.organizationId}/schedule/week`} className="card group p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow)]">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Building2 size={21} /></span>
                  <span className="badge badge-gray">{membership.role === "OWNER" ? "소유자" : membership.role === "ADMIN" ? "관리자" : "구성원"}</span>
                </div>
                <h2 className="mt-6 text-lg font-extrabold">{membership.organization.name}</h2>
                <p className="muted mt-1 line-clamp-2 min-h-10 text-sm">{membership.organization.description || "설명이 등록되지 않았습니다."}</p>
                <p className="mt-5 text-sm font-bold text-[var(--brand)]">일정표 열기 →</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card mt-7 grid place-items-center p-10 text-center">
            <Building2 size={34} className="text-[var(--brand)]" />
            <h2 className="mt-4 text-lg font-bold">참여 중인 조직이 없습니다</h2>
            <p className="muted mt-2 text-sm">새 조직을 만들거나 받은 입장 코드를 입력해 주세요.</p>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <form action={requestJoinAction} className="card p-6">
          <div className="flex items-center gap-3"><UserRoundPlus className="text-[var(--brand)]" /><h2 className="text-lg font-extrabold">조직 입장 신청</h2></div>
          <p className="muted mt-3 text-sm leading-6">관리자에게 받은 8~12자의 입장 코드를 입력하세요. 승인 후 일정에 접근할 수 있습니다.</p>
          <div className="mt-5 grid gap-4">
            <label className="label">입장 코드<input className="field uppercase tracking-[.2em]" name="code" minLength={8} maxLength={12} required /></label>
            <SubmitButton className="btn btn-secondary" pendingLabel="신청 중…">입장 신청하기</SubmitButton>
          </div>
          {pending.map((request) => <p key={request.id} className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{request.organization.name} 입장 승인 대기 중</p>)}
        </form>
        <details className="card group p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="flex items-center gap-3"><Plus className="text-[var(--brand)]" /><span className="text-lg font-extrabold">조직 생성</span></span><span className="badge badge-gray group-open:hidden">열기</span></summary>
          <form action={createOrganizationAction} className="mt-5 grid gap-4">
            <p className="muted text-sm">새 조직의 기본 정보와 입장 코드를 생성합니다.</p>
            <label className="label">조직명<input className="field" name="name" minLength={2} maxLength={60} required /></label>
            <label className="label">설명<textarea className="field" name="description" maxLength={500} /></label>
            <SubmitButton className="btn btn-primary" pendingLabel="만드는 중…">조직 생성하기</SubmitButton>
          </form>
        </details>
      </section>
    </main>
  );
}
