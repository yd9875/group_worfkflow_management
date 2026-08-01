import {
  approveJoinRequestAction,
  createReportReferencePrincipleAction,
  createDepartmentAction,
  deleteDepartmentAction,
  deleteOrganizationAction,
  deleteReportReferenceFileAction,
  deleteReportReferencePrincipleAction,
  getJoinCode,
  rejectJoinRequestAction,
  rotateJoinCodeAction,
  updateDepartmentAction,
  updateMemberAction,
  uploadReportReferenceFileAction,
} from "@/features/actions";
import { getAdminData } from "@/features/queries";
import { Building2, ClipboardCheck, FileText, FileUp, KeyRound, Paperclip, Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SubmitButton } from "@/components/submit-button";
import { AiConnectionSettings } from "@/components/ai-connection-settings";

const roleLabel = { OWNER: "소유자", ADMIN: "관리자", MEMBER: "구성원" };

type AdminData = Awaited<ReturnType<typeof getAdminData>>;
type AdminMember = AdminData["members"][number];

function MemberEditForm({
  data,
  member,
  compact = false,
}: {
  data: AdminData;
  member: AdminMember;
  compact?: boolean;
}) {
  const canManageRoles = data.currentMembership.role === "OWNER";
  if (!canManageRoles && member.role === "OWNER") {
    return (
      <p className="muted text-sm">
        소유자 정보는 소유자만 변경할 수 있습니다.
      </p>
    );
  }
  const successors = data.members.filter(
    (candidate) =>
      candidate.id !== member.id &&
      candidate.status === "ACTIVE" &&
      candidate.role !== "OWNER",
  );
  const departmentSelect = (
    <select
      aria-label="부서"
      className={compact ? "field w-auto min-w-32" : "field"}
      name="departmentId"
      defaultValue={member.departmentId}
    >
      {data.departments.map((department) => (
        <option key={department.id} value={department.id}>
          {department.name}
        </option>
      ))}
    </select>
  );
  const roleSelect = canManageRoles ? (
    <select
      aria-label="역할"
      className={compact ? "field w-auto min-w-28" : "field"}
      name="role"
      defaultValue={member.role}
    >
      <option value="MEMBER">구성원</option>
      <option value="ADMIN">관리자</option>
      <option value="OWNER">소유자</option>
    </select>
  ) : (
    <input type="hidden" name="role" value={member.role} />
  );
  const successorSelect =
    canManageRoles && member.role === "OWNER" ? (
      <select
        aria-label="새 소유자"
        className={compact ? "field w-auto min-w-40" : "field"}
        name="successorMembershipId"
        defaultValue=""
      >
        <option value="">새 소유자 선택</option>
        {successors.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.profileName?.trim() || candidate.user.name}
          </option>
        ))}
      </select>
    ) : null;

  return (
    <form
      action={updateMemberAction}
      className={compact ? "flex flex-wrap items-center gap-2" : "grid gap-3"}
    >
      <input type="hidden" name="organizationId" value={data.currentMembership.organizationId} />
      <input type="hidden" name="membershipId" value={member.id} />
      {compact ? departmentSelect : <label className="label">부서{departmentSelect}</label>}
      {compact ? roleSelect : canManageRoles ? <label className="label">역할{roleSelect}</label> : roleSelect}
      {successorSelect &&
        (compact ? successorSelect : (
          <label className="label">
            새 소유자
            {successorSelect}
            <span className="muted text-xs">
              소유자 역할을 관리자나 구성원으로 바꿀 때 선택하세요.
            </span>
          </label>
        ))}
      <SubmitButton className="btn btn-secondary" pendingLabel="저장 중…">
        변경 저장
      </SubmitButton>
    </form>
  );
}

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
        <p className="eyebrow">Entry requests</p>
        <h1 className="page-title mt-1">입장 신청</h1>
        <p className="muted mt-2">신청자의 부서를 지정한 뒤 승인하거나 신청을 거절합니다.</p>
        <div className="mt-6 grid gap-4">
          {data.requests.map((request) => (
            <article className="card flex flex-wrap items-center justify-between gap-5 p-5" key={request.id}>
              <div><h2 className="font-extrabold">{request.user.name}</h2><p className="muted mt-1 text-sm">{request.user.email} · {request.requestedAt.toLocaleDateString("ko-KR")}</p></div>
              <div className="flex flex-wrap gap-2">
                <form action={approveJoinRequestAction} className="flex gap-2">
                  <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="requestId" value={request.id} />
                  <select className="field w-auto" name="departmentId" required><option value="">부서 선택</option>{data.departments.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <SubmitButton className="btn btn-primary" pendingLabel="승인 중…">승인</SubmitButton>
                </form>
                <form action={rejectJoinRequestAction}>
                  <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="requestId" value={request.id} />
                  <SubmitButton className="btn btn-danger" pendingLabel="처리 중…">거절</SubmitButton>
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
            {data.departments.map((department) => (
              <div className="p-5" key={department.id}>
                {department.isSystem ? (
                  <div className="flex items-center justify-between gap-4">
                    <div><h2 className="font-extrabold">{department.name} <span className="badge badge-gray">시스템</span></h2><p className="muted mt-1 text-sm">{department.description || "설명 없음"}</p></div>
                  </div>
                ) : (
                  <form action={updateDepartmentAction} className="grid gap-3">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="departmentId" value={department.id} />
                    <label className="label">부서명<input className="field" name="name" defaultValue={department.name} maxLength={60} required /></label>
                    <label className="label">설명<textarea className="field" name="description" defaultValue={department.description ?? ""} maxLength={300} /></label>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton className="btn btn-secondary" pendingLabel="저장 중…">수정 저장</SubmitButton>
                      <ConfirmSubmitButton
                        className="btn btn-danger"
                        formAction={deleteDepartmentAction}
                        formNoValidate
                        message={`${department.name} 부서를 삭제할까요? 구성원은 기본 부서로 이동하고 부서 일정은 숨겨집니다.`}
                      >
                        부서 삭제
                      </ConfirmSubmitButton>
                    </div>
                    <p className="muted text-xs">삭제하면 구성원은 기본 부서로 이동하고, 이 부서의 일정은 숨겨집니다.</p>
                  </form>
                )}
              </div>
            ))}
          </div>
          <form action={createDepartmentAction} className="card h-fit p-5">
            <div className="flex items-center gap-2"><Building2 className="text-[var(--brand)]" /><h2 className="font-extrabold">부서 추가</h2></div>
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="mt-5 grid gap-4"><label className="label">부서명<input className="field" name="name" maxLength={60} required /></label><label className="label">설명<textarea className="field" name="description" maxLength={300} /></label><SubmitButton className="btn btn-primary" pendingLabel="추가 중…">추가하기</SubmitButton></div>
          </form>
        </div>
      </section>
    );
  }

  if (section === "settings") {
    const joinCode = await getJoinCode(organizationId);
    return (
      <section>
        <p className="eyebrow">Organization settings</p><h1 className="page-title mt-1">조직 관리</h1>
        <div className="mt-6 grid max-w-3xl gap-5">
          <article className="card p-6">
            <div className="flex items-center gap-3"><KeyRound className="text-[var(--brand)]" /><div><h2 className="font-extrabold">입장 코드</h2><p className="muted text-sm">코드를 공유하면 사용자가 조직 입장을 신청할 수 있습니다.</p></div></div>
            <p className="my-5 rounded-xl bg-slate-50 px-5 py-4 text-center font-mono text-2xl font-bold tracking-[.28em]">{joinCode}</p>
            <form action={rotateJoinCodeAction}><input type="hidden" name="organizationId" value={organizationId} /><SubmitButton className="btn btn-danger" pendingLabel="재발급 중…">입장 코드 재발급</SubmitButton></form>
          </article>
          <article className="card p-6">
            <div className="flex items-center gap-3"><FileText className="text-[var(--brand)]" /><div><h2 className="font-extrabold">AI 보고서 레퍼런스</h2><p className="muted text-sm">보고서에 반영할 조직 용어, 작성 원칙, 강조 지표와 예시를 등록하세요.</p></div></div>
            <form action={createReportReferencePrincipleAction}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <textarea className="field mt-5 min-h-32" name="content" maxLength={4000} placeholder="예: 임원 보고용 문체 사용, 부서별 핵심 지표 포함, 확인되지 않은 수치 작성 금지…" required />
              <SubmitButton className="btn btn-primary mt-3" pendingLabel="저장 중…">작성 원칙 저장</SubmitButton>
            </form>
            <div className="mt-5 grid gap-2 border-t border-[var(--line)] pt-5">
              <h3 className="font-extrabold">저장된 작성 원칙</h3>
              {data.reportPrinciples.map((principle, index) => (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-slate-50 px-4 py-3" key={principle.id}>
                  <p className="whitespace-pre-wrap text-sm leading-6"><span className="mr-2 font-extrabold text-[var(--brand)]">{index + 1}.</span>{principle.content}</p>
                  <form action={deleteReportReferencePrincipleAction} className="shrink-0">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="principleId" value={principle.id} />
                    <ConfirmSubmitButton className="btn btn-danger min-h-8 px-2 py-1 text-xs" message="이 작성 원칙을 삭제할까요?"><Trash2 size={13} /> 삭제</ConfirmSubmitButton>
                  </form>
                </div>
              ))}
              {!data.reportPrinciples.length && <p className="muted rounded-xl bg-slate-50 px-4 py-3 text-sm">저장된 작성 원칙이 없습니다.</p>}
            </div>
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <div className="flex items-start gap-3">
                <Paperclip className="mt-0.5 text-[var(--brand)]" size={19} />
                <div><h3 className="font-extrabold">보고서 양식 파일</h3><p className="muted mt-1 text-sm leading-6">AI가 첨부 파일의 제목 구성, 섹션 순서, 문체와 레이아웃을 참고해 같은 형태로 보고서를 작성합니다.</p></div>
              </div>
              <div className="mt-4 grid gap-2">
                {data.reportReferenceFiles.map((referenceFile) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-slate-50 px-4 py-3" key={referenceFile.id}>
                    <div className="min-w-0"><p className="truncate text-sm font-extrabold">{referenceFile.fileName}</p><p className="muted mt-1 text-xs">{(referenceFile.size / 1024 / 1024).toFixed(2)}MB · {referenceFile.updatedAt.toLocaleString("ko-KR")}</p></div>
                    <form action={deleteReportReferenceFileAction}>
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="referenceFileId" value={referenceFile.id} />
                      <ConfirmSubmitButton className="btn btn-danger" message={`${referenceFile.fileName} 파일을 삭제할까요?`}><Trash2 size={15} /> 삭제</ConfirmSubmitButton>
                    </form>
                  </div>
                ))}
                {!data.reportReferenceFiles.length && <p className="muted rounded-xl bg-slate-50 px-4 py-3 text-sm">첨부된 양식 파일이 없습니다.</p>}
              </div>
              <form action={uploadReportReferenceFileAction} className="mt-4 grid gap-3" encType="multipart/form-data">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input className="field cursor-pointer transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:shadow-md file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold" name="referenceFiles" type="file" accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain,text/markdown,text/csv,application/json" multiple required />
                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton className="btn btn-secondary" pendingLabel="첨부 중…"><FileUp size={16} /> 파일 첨부</SubmitButton>
                  <span className="muted text-xs">여러 파일 선택 가능 · PDF, TXT, MD, CSV, JSON · 파일당 최대 20MB (양식 보존은 PDF 권장)</span>
                </div>
              </form>
            </div>
          </article>
          <AiConnectionSettings organizationId={organizationId} />
          {data.currentMembership.role === "OWNER" && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="font-extrabold text-red-900">조직 삭제</h2>
              <p className="mt-2 text-sm leading-6 text-red-800">모든 부서, 일정, 입장 신청, 알림과 감사 기록이 영구 삭제됩니다. 계속하려면 조직 이름을 입력하세요.</p>
              <form action={deleteOrganizationAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input className="field flex-1" name="confirmation" placeholder={data.currentMembership.organization.name} required />
                <ConfirmSubmitButton className="btn btn-danger shrink-0" message="이 조직과 모든 데이터를 영구 삭제할까요? 되돌릴 수 없습니다.">조직 영구 삭제</ConfirmSubmitButton>
              </form>
            </section>
          )}
        </div>
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
      <p className="eyebrow">Member management</p><h1 className="page-title mt-1">구성원 관리</h1>
      <p className="muted mt-2">구성원의 부서와 역할을 관리합니다. 소유자 역할을 변경할 때는 조직을 이어받을 새 소유자를 선택해야 합니다.</p>
      <div className="admin-member-table card mt-6 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="p-4">구성원</th><th className="p-4">현재 역할</th><th className="p-4">부서·역할 변경</th><th className="p-4">상태</th></tr></thead>
          <tbody className="divide-y divide-[var(--line)]">
            {data.members.map((member) => <tr key={member.id}><td className="p-4"><b>{member.profileName?.trim() || member.user.name}</b><p className="muted mt-1">{member.user.email}</p></td><td className="p-4">{roleLabel[member.role]}</td><td className="p-4"><MemberEditForm compact data={data} member={member} /></td><td className="p-4"><span className={`badge ${member.status === "ACTIVE" ? "badge-green" : "badge-gray"}`}>{member.status === "ACTIVE" ? "활성" : "비활성"}</span></td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="admin-member-cards mt-6 grid gap-4">
        {data.members.map((member) => (
          <article className="card p-4" key={member.id}>
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-extrabold">{member.profileName?.trim() || member.user.name}</h2><p className="muted mt-1 break-all text-sm">{member.user.email}</p></div>
              <span className="badge badge-gray">{roleLabel[member.role]}</span>
            </div>
            <div className="mt-4">
              <MemberEditForm data={data} member={member} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
