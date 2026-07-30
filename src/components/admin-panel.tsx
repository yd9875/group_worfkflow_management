import {
  approveJoinRequestAction,
  createDepartmentAction,
  getJoinCode,
  rejectJoinRequestAction,
  rotateJoinCodeAction,
  transferOwnershipAction,
  updateMemberAction,
} from "@/features/actions";
import { getAdminData } from "@/features/queries";
import { Building2, ClipboardCheck, KeyRound } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const roleLabel = { OWNER: "소유자", ADMIN: "관리자", MEMBER: "구성원" };

export async function AdminPanel({
  organizationId,
  section,
}: {
  organizationId: string;
  section: string;
}) {
  const data = await getAdminData(organizationId);

  if (section === "requests") {
    return (
      <section>
        <p className="eyebrow">Join requests</p>
        <h1 className="page-title mt-1">가입 신청</h1>
        <p className="muted mt-2">신청자의 부서를 지정한 뒤 승인하거나 신청을 거절합니다.</p>
        <div className="mt-6 grid gap-4">
          {data.requests.map((request) => (
            <article className="card flex flex-wrap items-center justify-between gap-5 p-5" key={request.id}>
              <div><h2 className="font-extrabold">{request.user.name}</h2><p className="muted mt-1 text-sm">{request.user.email} · {request.requestedAt.toLocaleDateString("ko-KR")}</p></div>
              <div className="flex flex-wrap gap-2">
                <form action={approveJoinRequestAction} className="flex gap-2">
                  <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="requestId" value={request.id} />
                  <select className="field w-auto" name="departmentId" required><option value="">부서 선택</option>{data.departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <button className="btn btn-primary" type="submit">승인</button>
                </form>
                <form action={rejectJoinRequestAction}>
                  <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="requestId" value={request.id} />
                  <button className="btn btn-danger" type="submit">거절</button>
                </form>
              </div>
            </article>
          ))}
          {!data.requests.length && <div className="card p-10 text-center"><ClipboardCheck className="mx-auto text-[var(--brand)]" /><h2 className="mt-3 font-bold">대기 중인 신청이 없습니다</h2></div>}
        </div>
      </section>
    );
  }

  if (section === "departments") {
    return (
      <section>
        <p className="eyebrow">Departments</p><h1 className="page-title mt-1">부서 관리</h1>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="card divide-y divide-[var(--line)]">
            {data.departments.map((department) => <div className="flex items-center justify-between gap-4 p-5" key={department.id}><div><h2 className="font-extrabold">{department.name} {department.isSystem && <span className="badge badge-gray">시스템</span>}</h2><p className="muted mt-1 text-sm">{department.description || "설명 없음"}</p></div><span className={`badge ${department.isActive ? "badge-green" : "badge-gray"}`}>{department.isActive ? "활성" : "비활성"}</span></div>)}
          </div>
          <form action={createDepartmentAction} className="card h-fit p-5">
            <div className="flex items-center gap-2"><Building2 className="text-[var(--brand)]" /><h2 className="font-extrabold">부서 추가</h2></div>
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="mt-5 grid gap-4"><label className="label">부서명<input className="field" name="name" maxLength={60} required /></label><label className="label">설명<textarea className="field" name="description" maxLength={300} /></label><button className="btn btn-primary" type="submit">추가하기</button></div>
          </form>
        </div>
      </section>
    );
  }

  if (section === "settings") {
    const joinCode = await getJoinCode(organizationId);
    return (
      <section>
        <p className="eyebrow">Organization settings</p><h1 className="page-title mt-1">조직 설정</h1>
        <article className="card mt-6 max-w-2xl p-6">
          <div className="flex items-center gap-3"><KeyRound className="text-[var(--brand)]" /><div><h2 className="font-extrabold">가입 코드</h2><p className="muted text-sm">코드를 공유하면 사용자가 가입을 신청할 수 있습니다.</p></div></div>
          <p className="my-5 rounded-xl bg-slate-50 px-5 py-4 text-center font-mono text-2xl font-bold tracking-[.28em]">{joinCode}</p>
          <form action={rotateJoinCodeAction}><input type="hidden" name="organizationId" value={organizationId} /><button className="btn btn-danger" type="submit">가입 코드 재발급</button></form>
        </article>
      </section>
    );
  }

  if (section === "audit-logs") {
    return (
      <section><p className="eyebrow">Audit logs</p><h1 className="page-title mt-1">감사 로그</h1><div className="card mt-6 divide-y divide-[var(--line)]">{data.auditLogs.map((log) => <div className="grid gap-1 p-4 sm:grid-cols-[12rem_1fr_10rem]" key={log.id}><span className="font-bold">{log.action}</span><span className="muted text-sm">{log.actor?.name ?? "시스템"} · {log.entityType}</span><time className="muted text-sm">{log.createdAt.toLocaleString("ko-KR")}</time></div>)}{!data.auditLogs.length && <p className="p-10 text-center muted">기록된 작업이 없습니다.</p>}</div></section>
    );
  }

  return (
    <section>
      <p className="eyebrow">Members</p><h1 className="page-title mt-1">구성원 관리</h1>
      <p className="muted mt-2">구성원의 부서와 역할을 관리합니다. 소유자 역할은 변경할 수 없습니다.</p>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="p-4">구성원</th><th className="p-4">현재 역할</th><th className="p-4">부서·역할 변경</th><th className="p-4">상태</th></tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {data.members.map((member) => <tr key={member.id}><td className="p-4"><b>{member.user.name}</b><p className="muted mt-1">{member.user.email}</p></td><td className="p-4">{roleLabel[member.role]}</td><td className="p-4">{member.role === "OWNER" ? <span className="muted">소유자는 변경할 수 없습니다</span> : <div className="flex flex-wrap gap-2"><form action={updateMemberAction} className="flex gap-2"><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="membershipId" value={member.id} /><select className="field w-auto" name="departmentId" defaultValue={member.departmentId}>{data.departments.filter((item) => item.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select className="field w-auto" name="role" defaultValue={member.role}><option value="MEMBER">구성원</option><option value="ADMIN">관리자</option></select><button className="btn btn-secondary" type="submit">저장</button></form>{data.currentMembership.role === "OWNER" && <form action={transferOwnershipAction}><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="membershipId" value={member.id} /><ConfirmSubmitButton className="btn btn-danger" message={`${member.user.name} 님에게 조직 소유권을 이전할까요? 이전 후 본인은 관리자가 됩니다.`}>소유권 이전</ConfirmSubmitButton></form>}</div>}</td><td className="p-4"><span className={`badge ${member.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>{member.status === "ACTIVE" ? "활성" : "비활성"}</span></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
