import type { Metadata } from "next";
import Link from "next/link";
import {
  PRIVACY_POLICY_VERSION,
  SIGNUP_PRIVACY_NOTICE,
} from "@/lib/privacy";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "조직 일정 관리 서비스의 개인정보 수집·이용 및 국외 처리위탁 안내",
};

const controllerName =
  process.env.PRIVACY_CONTROLLER_NAME ?? "조직 일정 관리 운영자";
const privacyContact =
  process.env.PRIVACY_CONTACT_EMAIL ?? "운영자 연락처 미설정";
const databaseCountry =
  process.env.PRIVACY_DB_COUNTRY ?? "싱가포르";
const databaseProvider =
  process.env.PRIVACY_DB_PROVIDER ?? "Aiven Ltd";
const databaseProviderContact =
  process.env.PRIVACY_DB_CONTACT ?? "dpo@aiven.io";
const infrastructureProvider =
  process.env.PRIVACY_DB_INFRA_PROVIDER ?? "DigitalOcean LLC";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-9">
        <Link className="text-sm font-bold text-[var(--brand)]" href="/">
          ← 조직 일정 관리
        </Link>
        <p className="eyebrow mt-8">Privacy policy</p>
        <h1 className="page-title mt-2">개인정보 처리방침</h1>
        <p className="muted mt-3 leading-7">
          {controllerName}는 서비스 제공에 필요한 최소한의 개인정보를 처리하며,
          이용자의 개인정보를 안전하게 관리하기 위해 다음과 같이 처리방침을 공개합니다.
        </p>
        <p className="muted mt-2 text-sm">
          시행일 및 버전: {PRIVACY_POLICY_VERSION}
        </p>
      </header>

      <div className="grid gap-5">
        <PolicySection title="1. 개인정보 수집·이용">
          <PolicyList
            rows={[
              ["처리 목적", SIGNUP_PRIVACY_NOTICE.purpose],
              ["필수 수집 항목", SIGNUP_PRIVACY_NOTICE.requiredItems],
              ["자동 생성 항목", SIGNUP_PRIVACY_NOTICE.automaticItems],
              ["보유·이용 기간", SIGNUP_PRIVACY_NOTICE.retention],
              ["동의 거부권", SIGNUP_PRIVACY_NOTICE.refusal],
            ]}
          />
          <p className="muted mt-4 text-sm leading-6">
            조직 입장 이후에는 소속 조직·부서·역할, 입장 신청, 일정, 알림 및
            감사 기록처럼 서비스 이용 과정에서 이용자가 입력하거나 생성한 정보가
            추가로 처리됩니다.
          </p>
        </PolicySection>

        <PolicySection title="2. 개인정보 파기와 회원 탈퇴">
          <p className="muted leading-7">
            이용자는 계정 설정에서 직접 회원 탈퇴를 요청할 수 있습니다. 탈퇴가
            완료되면 계정·인증정보, 세션, 멤버십, 입장 신청, 알림, 사용자 환경설정과
            개인 일정은 활성 데이터베이스에서 삭제됩니다. 공동 일정과 감사 기록은
            조직의 업무 연속성과 보안 기록을 위해 보존할 수 있으나, 탈퇴자의 사용자
            식별 연결값은 제거됩니다.
          </p>
          <p className="muted mt-3 leading-7">
            관계 법령에 따라 보존 의무가 있는 정보는 해당 기간 동안 다른 정보와
            분리하여 보관한 뒤 기간 만료 시 복구할 수 없는 방식으로 파기합니다.
            백업본은 데이터베이스 제공자의 백업 보존주기가 끝나는 시점에
            순차적으로 파기됩니다.
          </p>
        </PolicySection>

        <PolicySection title="3. 국외 보관·처리위탁">
          <p className="muted mb-4 leading-7">
            서비스는 관리형 PostgreSQL 데이터베이스 운영을 위해 다음과 같이
            개인정보의 국외 보관과 처리를 위탁합니다.
          </p>
          <PolicyList
            rows={[
              [
                "이전받는 자",
                `${databaseProvider} (${databaseProviderContact}), 인프라 하위처리자: ${infrastructureProvider}`,
              ],
              ["이전 국가", databaseCountry],
              [
                "이전 항목",
                "계정정보, 조직·부서·역할, 입장 신청, 일정, 알림, 감사 기록 및 서비스 이용 과정에서 생성되는 정보",
              ],
              [
                "이전 시기·방법",
                "회원가입 및 서비스 이용 중 수시로, 암호화된 네트워크 통신을 통해 이전",
              ],
              [
                "이전 목적",
                "PostgreSQL 데이터베이스 호스팅, 백업, 장애 복구, 보안과 안정적인 서비스 운영",
              ],
              [
                "보유·이용 기간",
                "회원 탈퇴 또는 처리위탁 계약 종료 시까지. 활성 데이터는 탈퇴 처리 시 삭제하고 백업본은 제공자의 보존주기 만료 시 파기",
              ],
              [
                "이전 거부 방법·영향",
                "국외 이전을 원하지 않으면 회원가입을 진행하지 않거나 회원 탈퇴를 요청할 수 있으며, 이 경우 서비스 이용이 제한됩니다.",
              ],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <a
              className="font-bold text-[var(--brand)] underline underline-offset-4"
              href="https://aiven.io/dpa"
              rel="noreferrer"
              target="_blank"
            >
              Aiven 데이터 처리계약
            </a>
            <a
              className="font-bold text-[var(--brand)] underline underline-offset-4"
              href="https://aiven.io/subprocessors"
              rel="noreferrer"
              target="_blank"
            >
              Aiven 하위처리자 목록
            </a>
          </div>
        </PolicySection>

        <PolicySection title="4. 이용자의 권리">
          <p className="muted leading-7">
            이용자는 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 및 동의
            철회를 요청할 수 있습니다. 회원 탈퇴는 계정 설정에서 직접 처리할 수
            있으며, 그 밖의 요청은 아래 개인정보 보호 문의처로 접수할 수 있습니다.
          </p>
        </PolicySection>

        <PolicySection title="5. 개인정보 보호 문의">
          <PolicyList
            rows={[
              ["개인정보처리자", controllerName],
              ["문의 이메일", privacyContact],
            ]}
          />
          {privacyContact === "운영자 연락처 미설정" && (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              운영 배포 전에 PRIVACY_CONTACT_EMAIL 환경변수에 실제 문의 이메일을
              등록해야 합니다.
            </p>
          )}
        </PolicySection>

        <PolicySection title="6. 처리방침 변경">
          <p className="muted leading-7">
            처리방침이 변경되면 시행 전에 서비스 화면을 통해 알립니다. 수집 목적,
            항목 또는 보유기간처럼 동의 내용이 변경되는 경우에는 필요한 절차에 따라
            다시 안내하고 동의를 받습니다.
          </p>
        </PolicySection>
      </div>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PolicyList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
      {rows.map(([term, description]) => (
        <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]" key={term}>
          <dt className="font-bold text-slate-700">{term}</dt>
          <dd className="muted leading-6">{description}</dd>
        </div>
      ))}
    </dl>
  );
}
