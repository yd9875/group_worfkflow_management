import { Search, Users } from "lucide-react";
import { getOrganizationContext } from "@/features/queries";

const roleLabel = { OWNER: "소유자", ADMIN: "관리자", MEMBER: "구성원" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { members } = await getOrganizationContext(organizationId);
  return (
    <section>
      <p className="eyebrow">People</p><h1 className="page-title mt-1">구성원</h1>
      <div className="card mt-5 flex items-center gap-2 p-3"><Search className="muted" size={17} /><input className="w-full border-0 bg-transparent p-2 outline-none" placeholder="이름 또는 이메일로 검색" aria-label="구성원 검색" /></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => <article key={member.id} className="card p-5"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand)]">{member.user.name.slice(0, 1)}</span><span className="badge badge-gray">{roleLabel[member.role]}</span></div><h2 className="mt-5 font-extrabold">{member.user.name}</h2><p className="muted mt-1 text-sm">{member.user.email}</p><p className="mt-4 text-sm font-bold">{member.department.name}</p></article>)}
      </div>
      {!members.length && <div className="card mt-5 p-10 text-center"><Users className="mx-auto text-[var(--brand)]" /><p className="mt-3 font-bold">구성원이 없습니다</p></div>}
    </section>
  );
}
