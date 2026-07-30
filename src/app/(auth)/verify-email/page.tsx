import Link from "next/link";
import { CalendarCheck2, MailCheck } from "lucide-react";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="card w-full max-w-lg p-8 text-center sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {params.error ? <CalendarCheck2 size={30} /> : <MailCheck size={30} />}
        </span>
        <p className="eyebrow mt-6">이메일 인증</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
          {params.error ? "인증 링크를 확인해 주세요" : "받은편지함을 확인해 주세요"}
        </h1>
        <p className="muted mt-4 leading-7">
          {params.email ? `${params.email}로 ` : ""}
          인증 링크를 보냈습니다. 링크는 한 시간 동안 유효하며 한 번만 사용할 수 있습니다.
        </p>
        <Link href="/login" className="btn btn-primary mt-8 w-full">로그인으로 이동</Link>
      </section>
    </main>
  );
}
