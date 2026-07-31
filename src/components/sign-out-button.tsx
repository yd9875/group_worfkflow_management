"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useGlobalLoading } from "@/components/global-loading";

export function SignOutButton() {
  const { startLoading, stopLoading } = useGlobalLoading();
  return (
    <button
      className="btn btn-quiet w-full justify-start"
      onClick={async () => {
        startLoading(30000);
        const result = await authClient.signOut();
        if (result.error) {
          stopLoading();
          return;
        }
        window.location.href = "/login";
      }}
      type="button"
    >
      <LogOut size={17} /> 로그아웃
    </button>
  );
}
