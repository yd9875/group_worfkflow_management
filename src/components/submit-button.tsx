"use client";

import { useFormStatus } from "react-dom";
import { LoadingOverlay } from "@/components/loading-overlay";

export function SubmitButton({
  children,
  pendingLabel = "처리 중…",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <button {...props} disabled={disabled || pending} type="submit">
        {pending ? pendingLabel : children}
      </button>
      {pending && <LoadingOverlay label={pendingLabel} />}
    </>
  );
}
