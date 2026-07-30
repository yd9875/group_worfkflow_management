"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailCard({
  email,
  error,
}: {
  email?: string;
  error?: string;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function resendVerificationEmail() {
    if (!email) {
      setIsError(true);
      setMessage("재전송할 이메일 주소가 없습니다. 회원가입 화면에서 다시 시도해 주세요.");
      return;
    }

    setSending(true);
    setMessage("");
    setIsError(false);

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/verify-email",
      });

      if (result.error) {
        throw new Error("인증 메일을 다시 보내지 못했습니다. 잠시 후 시도해 주세요.");
      }

      setMessage("인증 메일을 다시 보냈습니다. 스팸함과 프로모션함도 확인해 주세요.");
    } catch (sendError) {
      setIsError(true);
      setMessage(
        sendError instanceof Error
          ? sendError.message
          : "인증 메일을 다시 보내지 못했습니다.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-5">
      <section className="card w-full max-w-lg p-8 text-center sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {error ? <CalendarCheck2 size={30} /> : <MailCheck size={30} />}
        </span>
        <p className="eyebrow mt-6">이메일 인증</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
          {error ? "인증 링크를 확인해 주세요" : "받은편지함을 확인해 주세요"}
        </h1>
        <p className="muted mt-4 leading-7">
          {email ? `${email}로 ` : ""}
          인증 링크를 보냈습니다. 링크는 한 시간 동안 유효하며 한 번만 사용할 수 있습니다.
        </p>
        {message ? (
          <p
            className={`mt-5 text-sm font-semibold ${
              isError ? "text-red-600" : "text-[var(--brand)]"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary mt-8 w-full"
          disabled={sending || !email}
          onClick={resendVerificationEmail}
        >
          {sending ? "보내는 중..." : "인증 메일 다시 보내기"}
        </button>
        <Link href="/login" className="btn btn-primary mt-3 w-full">
          로그인으로 이동
        </Link>
      </section>
    </main>
  );
}
