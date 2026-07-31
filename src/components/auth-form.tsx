"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  PRIVACY_POLICY_VERSION,
  SIGNUP_PRIVACY_NOTICE,
} from "@/lib/privacy";
import { useGlobalLoading } from "@/components/global-loading";

type Mode = "login" | "signup" | "forgot" | "reset";

const copy = {
  login: {
    eyebrow: "다시 만나 반갑습니다",
    title: "로그인",
    description: "참여 중인 조직의 최신 일정을 확인하세요.",
    submit: "로그인",
  },
  signup: {
    eyebrow: "새로운 협업의 시작",
    title: "회원가입",
    description: "이메일 인증 후 조직을 만들거나 가입할 수 있습니다.",
    submit: "인증 메일 받기",
  },
  forgot: {
    eyebrow: "계정 복구",
    title: "비밀번호 찾기",
    description: "가입한 이메일로 재설정 링크를 보내드립니다.",
    submit: "재설정 메일 받기",
  },
  reset: {
    eyebrow: "새 비밀번호",
    title: "비밀번호 재설정",
    description: "10자 이상의 안전한 새 비밀번호를 입력하세요.",
    submit: "비밀번호 변경",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const current = copy[mode];
  const { startLoading, stopLoading } = useGlobalLoading();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    startLoading(30000);
    setMessage("");
    setIsError(false);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      if (mode === "signup") {
        if (data.get("consent") !== "on") throw new Error("개인정보 이용에 동의해 주세요.");
        const response = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: String(data.get("name") ?? ""),
            email,
            password,
            consentedAt: new Date().toISOString(),
            consentVersion: PRIVACY_POLICY_VERSION,
            callbackURL: "/verify-email",
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "가입 정보를 확인해 주세요.");
        }
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else if (mode === "login") {
        const result = await authClient.signIn.email({
          email,
          password,
          callbackURL: "/organizations",
        });
        if (result.error) {
          const errorMessage =
            result.error.code === "EMAIL_NOT_VERIFIED"
              ? "이메일 인증을 먼저 완료해 주세요."
              : "이메일 또는 비밀번호를 확인해 주세요.";
          throw new Error(errorMessage);
        }
        router.push("/organizations");
        router.refresh();
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        setMessage("계정이 존재하면 비밀번호 재설정 메일을 보내드립니다.");
        stopLoading();
      } else {
        const token = searchParams.get("token");
        if (!token) throw new Error("유효한 재설정 링크가 필요합니다.");
        const result = await authClient.resetPassword({ token, newPassword: password });
        if (result.error) throw new Error("링크가 만료되었거나 사용할 수 없습니다.");
        setMessage("비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
        setTimeout(() => router.push("/login"), 900);
      }
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.");
      stopLoading();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-story" aria-label="서비스 소개">
        <div className="relative z-10 flex items-center gap-3 text-lg font-bold">
          <span className="grid size-10 place-items-center rounded-xl bg-white/12">
            <CalendarDays size={21} />
          </span>
          조직 일정 관리
        </div>
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-sm font-bold tracking-[.16em] text-emerald-200">GROUP WORKFLOW MANAGEMENT</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-[-.045em] lg:text-6xl">
            조직의 흐름을
            <br />
            한눈에 맞춥니다.
          </h2>
          <p className="mt-7 max-w-lg text-base leading-7 text-emerald-50/75">
            조직 전체, 부서, 개인 일정을 주간표와 월간 캘린더에서 함께 확인하세요.
          </p>
        </div>
        <div className="relative z-10 flex gap-7 text-sm text-emerald-50/70">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} /> 통합 일정 관리</span>
          <span className="flex items-center gap-2"><CheckCircle2 size={16} /> 지속 가능한 업무 협조</span>
        </div>
      </section>
      <main className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{current.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.05em]">{current.title}</h1>
          <p className="muted mt-3 leading-7">{current.description}</p>

          <form className="mt-9 grid gap-5" onSubmit={onSubmit}>
            {mode === "signup" && (
              <label className="label">
                이름
                <input className="field" name="name" autoComplete="name" minLength={2} maxLength={60} required />
              </label>
            )}
            {mode !== "reset" && (
              <label className="label">
                이메일
                <input className="field" name="email" type="email" autoComplete="email" required />
              </label>
            )}
            {mode !== "forgot" && (
              <label className="label">
                비밀번호
                <span className="relative">
                  <input
                    className="field pr-12"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={10}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {mode !== "login" && <small className="muted font-normal">10자 이상 128자 이하</small>}
              </label>
            )}
            {mode === "signup" && (
              <>
                <section
                  aria-labelledby="privacy-notice-title"
                  className="rounded-xl border border-[var(--line)] bg-slate-50/80 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="privacy-notice-title" className="font-extrabold">
                      [필수] 개인정보 수집·이용 안내
                    </h2>
                    <span className="badge badge-gray">v{PRIVACY_POLICY_VERSION}</span>
                  </div>
                  <dl className="mt-3 grid gap-3 leading-6">
                    <div>
                      <dt className="font-bold text-slate-700">수집·이용 목적</dt>
                      <dd className="muted">{SIGNUP_PRIVACY_NOTICE.purpose}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-700">수집 항목</dt>
                      <dd className="muted">
                        필수: {SIGNUP_PRIVACY_NOTICE.requiredItems}
                        <br />
                        자동 생성: {SIGNUP_PRIVACY_NOTICE.automaticItems}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-700">보유·이용 기간</dt>
                      <dd className="muted">{SIGNUP_PRIVACY_NOTICE.retention}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-700">동의 거부권과 불이익</dt>
                      <dd className="muted">{SIGNUP_PRIVACY_NOTICE.refusal}</dd>
                    </div>
                  </dl>
                  <Link
                    className="mt-3 inline-flex font-bold text-[var(--brand)] underline underline-offset-4"
                    href="/privacy"
                  >
                    개인정보 처리방침 전체 보기
                  </Link>
                </section>
                <label className="flex items-start gap-3 text-sm leading-6">
                  <input className="mt-1 size-4 accent-[var(--brand)]" name="consent" type="checkbox" required />
                  <span>위 개인정보 수집·이용 내용을 확인했으며 이에 동의합니다. (필수)</span>
                </label>
              </>
            )}
            {message && (
              <p role="alert" className={`rounded-xl px-4 py-3 text-sm ${isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
                {message}
              </p>
            )}
            <button className="btn btn-primary mt-1 w-full" type="submit" disabled={loading}>
              {loading ? "처리 중…" : current.submit}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm">
            {mode === "login" ? (
              <>
                <Link className="font-semibold text-[var(--brand)]" href="/signup">처음이신가요? 회원가입</Link>
                <Link className="muted" href="/forgot-password">비밀번호 찾기</Link>
              </>
            ) : (
              <Link className="font-semibold text-[var(--brand)]" href="/login">로그인으로 돌아가기</Link>
            )}
            <Link className="muted underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
