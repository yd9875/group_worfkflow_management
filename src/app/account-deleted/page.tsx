import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function AccountDeletedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="card w-full max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto text-[var(--brand)]" size={38} />
        <h1 className="mt-5 text-2xl font-extrabold">회원 탈퇴가 완료되었습니다</h1>
        <p className="muted mt-3 leading-7">
          계정과 개인정보가 처리방침에 따라 파기되었습니다.
        </p>
        <Link className="btn btn-primary mt-7" href="/login">
          로그인 화면으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
