"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { LoadingOverlay } from "@/components/loading-overlay";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return (
    <>
      <button
        className="btn btn-quiet w-full justify-start"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          const { authClient } = await import("@/lib/auth-client");
          const result = await authClient.signOut();
          if (result.error) {
            setLoading(false);
            return;
          }
          window.location.href = "/login";
        }}
        type="button"
      >
        <LogOut size={17} /> {loading ? "로그아웃 중…" : "로그아웃"}
      </button>
      {loading && <LoadingOverlay label="로그아웃 중" />}
    </>
  );
}
