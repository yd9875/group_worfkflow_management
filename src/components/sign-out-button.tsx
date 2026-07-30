"use client";

import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="btn btn-quiet w-full justify-start"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/login";
      }}
      type="button"
    >
      <LogOut size={17} /> 로그아웃
    </button>
  );
}
