"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function DeleteAccountForm({
  blocked,
}: {
  blocked: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked) return;
    if (confirmation !== "회원탈퇴") {
      setMessage('"회원탈퇴"를 정확히 입력해 주세요.');
      return;
    }

    setLoading(true);
    setMessage("");
    const result = await authClient.deleteUser({
      password,
      callbackURL: "/account-deleted",
    });
    if (result.error) {
      const errorMessage =
        result.error.code === "INVALID_PASSWORD"
          ? "비밀번호가 올바르지 않습니다."
          : result.error.message ?? "회원 탈퇴를 처리하지 못했습니다.";
      setMessage(errorMessage);
      setLoading(false);
      return;
    }
    window.location.href = "/account-deleted";
  }

  return (
    <form className="card border-red-200 p-5 sm:p-6" onSubmit={onSubmit}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-[var(--danger)]">
          <AlertTriangle size={20} />
        </span>
        <div>
          <h2 className="font-extrabold text-[var(--danger)]">회원 탈퇴</h2>
          <p className="muted mt-1 text-sm leading-6">
            이 작업은 되돌릴 수 없습니다. 비밀번호와 확인 문구를 입력한 뒤
            탈퇴할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="label">
          현재 비밀번호
          <input
            autoComplete="current-password"
            className="field"
            disabled={blocked || loading}
            minLength={10}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="label">
          확인을 위해 ‘회원탈퇴’ 입력
          <input
            className="field"
            disabled={blocked || loading}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="회원탈퇴"
            required
            value={confirmation}
          />
        </label>
        {message && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {message}
          </p>
        )}
        <button
          className="btn btn-danger w-full"
          disabled={blocked || loading}
          type="submit"
        >
          <Trash2 size={17} />
          {loading ? "개인정보 파기 중…" : "회원 탈퇴 및 개인정보 파기"}
        </button>
      </div>
    </form>
  );
}
