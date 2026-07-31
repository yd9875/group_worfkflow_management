"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useGlobalLoading } from "@/components/global-loading";

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
  const { startLoading, stopLoading } = useGlobalLoading();

  useEffect(() => {
    if (pending) startLoading(30000);
    else stopLoading();
  }, [pending, startLoading, stopLoading]);

  return (
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
  );
}
