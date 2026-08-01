"use client";

import { useFormStatus } from "react-dom";
import { LoadingOverlay } from "@/components/loading-overlay";

export function ConfirmSubmitButton({
  children,
  message,
  className = "btn btn-danger",
  disabled,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> & {
  message: string;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <button
        className={className}
        disabled={pending || disabled}
        onClick={(event) => {
          if (!window.confirm(message)) event.preventDefault();
        }}
        type="submit"
        {...props}
      >
        {pending ? "처리 중…" : children}
      </button>
      {pending && <LoadingOverlay />}
    </>
  );
}
