"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LoadingContextValue = {
  startLoading: (timeout?: number) => void;
  stopLoading: () => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function useGlobalLoading() {
  const value = useContext(LoadingContext);
  if (!value) throw new Error("GlobalLoadingProvider가 필요합니다.");
  return value;
}

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const stopLoading = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setLoading(false);
  }, []);

  const startLoading = useCallback((timeout = 8000) => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setLoading(false);
    }, timeout);
  }, []);

  useEffect(() => {
    const routeTimer = setTimeout(stopLoading, 0);
    return () => clearTimeout(routeTimer);
  }, [pathname, searchParams, stopLoading]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin === window.location.origin && url.href !== window.location.href) startLoading();
    }

    function onSubmit(event: SubmitEvent) {
      if (!event.defaultPrevented) startLoading(1800);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [startLoading]);

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading }}>
      {children}
      {loading && (
        <div className="global-loading" role="status" aria-live="polite" aria-label="처리 중">
          <span className="global-loading-spinner" />
          <span className="sr-only">처리 중입니다.</span>
        </div>
      )}
    </LoadingContext.Provider>
  );
}
