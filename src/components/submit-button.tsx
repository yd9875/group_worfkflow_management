"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useGlobalLoading } from "@/components/global-loading";

export function SubmitButton({
  children,
  pendingLabel = "처리 중…",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const { startLoading, stopLoading } = useGlobalLoading();

  useEffect(() => {
    if (pending) startLoading(30000);
    else stopLoading();
  }, [pending, startLoading, stopLoading]);

  return (
    <button {...props} disabled={disabled || pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
