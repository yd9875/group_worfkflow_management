import Link from "next/link";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { SignOutButton } from "@/components/sign-out-button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { updateOrganizationProfileAction } from "@/features/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const [ownedOrganizations, activeMemberships] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id, role: "OWNER", status: "ACTIVE" },
      select: {
        organizationId: true,
        organization: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.membership.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: {
        id: true,
        organizationId: true,
        profileName: true,
        organization: { select: { name: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  const organizations = await Promise.all(
    ownedOrganizations.map(async (membership) => ({
      id: membership.organizationId,
      name: membership.organization.name,
      otherActiveMembers: await prisma.membership.count({
        where: {
          organizationId: membership.organizationId,
          userId: { not: user.id },
          status: "ACTIVE",
        },
      }),
    })),
  );
  const transferRequired = organizations.filter(
    (organization) => organization.otherActiveMembers > 0,
  );
  const deletedWithAccount = organizations.filter(
    (organization) => organization.otherActiveMembers === 0,
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-bold text-[var(--brand)]" href="/organizations">
            <ArrowLeft size={16} /> 조직 선택으로 돌아가기
          </Link>
          <p className="eyebrow mt-7">Account</p>
          <h1 className="page-title mt-2">계정 설정</h1>
          <p className="muted mt-2">{user.name} · {user.email}</p>
        </div>
        <div className="w-32"><SignOutButton /></div>
      </header>

      <section className="card mt-8 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <Building2 size={20} />
          </span>
          <div className="w-full min-w-0">
            <h2 className="font-extrabold">프로필 설정</h2>
            <p className="muted mt-1 text-sm leading-6">
              일정표에 표시할 이름을 조직별로 설정할 수 있습니다. 비워 두면 계정 이름인 {user.name}이 표시됩니다.
            </p>
            <div className="mt-5 grid gap-4">
              {activeMemberships.map((membership) => (
                <form action={updateOrganizationProfileAction} className="rounded-xl border border-[var(--line)] p-4" key={membership.id}>
                  <input type="hidden" name="organizationId" value={membership.organizationId} />
                  <label className="label">
                    {membership.organization.name}
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        className="field flex-1"
                        name="profileName"
                        defaultValue={membership.profileName ?? ""}
                        maxLength={60}
                        placeholder={user.name}
                      />
                      <SubmitButton className="btn btn-secondary shrink-0" pendingLabel="저장 중…">프로필명 저장</SubmitButton>
                    </div>
                  </label>
                </form>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="font-extrabold">탈퇴 시 파기되는 정보</h2>
            <p className="muted mt-1 text-sm leading-6">
              계정·로그인 정보, 세션, 조직 멤버십, 입장 신청, 알림, 사용자
              환경설정과 개인 일정이 삭제됩니다. 공동 일정과 감사 기록은 사용자
              식별 연결값을 제거한 뒤 조직 기록으로 남습니다.
            </p>
            <Link className="mt-3 inline-flex text-sm font-bold text-[var(--brand)] underline underline-offset-4" href="/privacy">
              개인정보 처리방침 확인
            </Link>
          </div>
        </div>
      </section>

      {transferRequired.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <h2 className="font-extrabold text-amber-950">먼저 소유권을 이전해 주세요</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            다른 구성원이 있는 조직의 소유자는 바로 탈퇴할 수 없습니다.
          </p>
          <div className="mt-4 grid gap-3">
            {transferRequired.map((organization) => (
              <Link
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 font-bold text-amber-950"
                href={`/org/${organization.id}/admin/members`}
                key={organization.id}
              >
                <span className="flex items-center gap-2"><Building2 size={17} /> {organization.name}</span>
                <span className="text-sm">구성원 {organization.otherActiveMembers}명 →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {deletedWithAccount.length > 0 && (
        <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
          <h2 className="font-extrabold text-red-900">함께 삭제되는 조직</h2>
          <p className="mt-2 text-sm leading-6 text-red-800">
            다른 활성 구성원이 없는 아래 조직과 조직 내 모든 일정·기록은 회원
            탈퇴와 함께 삭제됩니다.
          </p>
          <ul className="mt-3 grid gap-2 text-sm font-bold text-red-900">
            {deletedWithAccount.map((organization) => (
              <li key={organization.id}>• {organization.name}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5">
        <DeleteAccountForm blocked={transferRequired.length > 0} />
      </div>
    </main>
  );
}
