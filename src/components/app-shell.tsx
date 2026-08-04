"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  House,
  MoveHorizontal,
  NotebookPen,
  Search,
  Settings2,
  UserRoundCog,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { LoadingOverlay } from "@/components/loading-overlay";

type Props = {
  organizationId: string;
  organizationName: string;
  joinCode: string;
  userName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  unreadCount: number;
  children: React.ReactNode;
};

function NavigationLoadingBoundary({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startNavigation = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    const target = event.target as HTMLElement;
    const explicitTrigger = target.closest<HTMLElement>("[data-loading-overlay]");
    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (explicitTrigger) {
      setIsNavigating(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsNavigating(false), 12_000);
      return;
    }
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;

    const destination = new URL(link.href, window.location.href);
    const current = new URL(window.location.href);
    if (
      destination.origin !== current.origin ||
      destination.href === current.href ||
      (destination.pathname === current.pathname &&
        destination.search === current.search &&
        destination.hash !== current.hash)
    ) return;

    setIsNavigating(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsNavigating(false), 12_000);
  };

  return (
    <div className="app-grid" onClickCapture={startNavigation}>
      {children}
      {isNavigating && <LoadingOverlay label="페이지를 불러오는 중…" />}
    </div>
  );
}

export function AppShell({
  organizationId,
  organizationName,
  joinCode,
  userName,
  role,
  unreadCount,
  children,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sidebarRef = useRef<HTMLElement>(null);
  const [showMobileScrollHint, setShowMobileScrollHint] = useState(false);
  const root = `/org/${organizationId}`;
  const links = [
    { href: `${root}/schedule/day`, label: "일일 계획", icon: CalendarCheck2 },
    { href: `${root}/schedule/week`, label: "주간 일정", icon: CalendarRange },
    { href: `${root}/schedule/month`, label: "월간 일정", icon: CalendarDays },
    { href: `${root}/search`, label: "일정 및 업무 검색", icon: Search },
    { href: `${root}/members`, label: "구성원 현황", icon: Users },
  ];
  const quickLinks = [
    { href: "/organizations", label: "홈", icon: House },
    { href: `${root}/notifications`, label: `알림${unreadCount ? ` ${unreadCount}` : ""}`, icon: Bell },
    { href: "/account", label: "계정", icon: UserRoundCog },
  ];
  const active = (href: string) => pathname.startsWith(href);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const updateScrollHint = () => {
      const isMobile = window.matchMedia("(max-width: 860px)").matches;
      const hasMoreOnRight =
        sidebar.scrollLeft + sidebar.clientWidth < sidebar.scrollWidth - 4;
      setShowMobileScrollHint(isMobile && hasMoreOnRight);
    };
    updateScrollHint();
    sidebar.addEventListener("scroll", updateScrollHint, { passive: true });
    window.addEventListener("resize", updateScrollHint);
    return () => {
      sidebar.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
    };
  }, [role, unreadCount]);

  return (
    <NavigationLoadingBoundary key={`${pathname}?${searchParams.toString()}`}>
      <aside className="sidebar" ref={sidebarRef}>
        <div className="sidebar-brand mb-5 flex items-center gap-3 px-2 py-2">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><CalendarDays size={20} /></span>
          <span className="font-extrabold tracking-[-.03em]">조직 일정 관리</span>
        </div>
        <div className="sidebar-meta card mb-5 flex items-center gap-2 p-3">
          <span className="min-w-0">
            <span className="muted block text-[.68rem] font-bold">현재 조직</span>
            <span className="block truncate text-sm font-bold">{organizationName}</span>
            <span className="muted mt-0.5 block truncate font-mono text-[.62rem] tracking-[.08em]">
              입장 코드 {joinCode}
            </span>
          </span>
        </div>
        <nav className="sidebar-quick card mb-5 grid gap-1 p-2" aria-label="사용자 메뉴">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} className={`nav-link ${active(href) ? "nav-link-active" : ""}`} href={href}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <nav className="card mb-5 grid gap-1 p-2" aria-label="개인 일정 메뉴">
          <Link className={`nav-link ${active(`${root}/personal`) ? "nav-link-active" : ""}`} href={`${root}/personal`}>
            <NotebookPen size={18} />
            <span>개인 일정 관리</span>
          </Link>
        </nav>
        <nav className="grid gap-1" aria-label="주 메뉴">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} className={`nav-link ${active(href) ? "nav-link-active" : ""}`} href={href}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        {(role === "OWNER" || role === "ADMIN") && (
          <div className="sidebar-admin mt-6">
            <p className="muted mb-2 px-3 text-[.68rem] font-bold tracking-[.1em]">관리</p>
            <Link className={`nav-link ${active(`${root}/admin/requests`) ? "nav-link-active" : ""}`} href={`${root}/admin/requests`}><ClipboardList size={18} /> 입장 신청</Link>
            <Link className={`nav-link ${active(`${root}/admin/members`) ? "nav-link-active" : ""}`} href={`${root}/admin/members`}><Users size={18} /> 구성원 관리</Link>
            <Link className={`nav-link ${active(`${root}/admin/departments`) ? "nav-link-active" : ""}`} href={`${root}/admin/departments`}><Building2 size={18} /> 부서 관리</Link>
            <Link className={`nav-link ${active(`${root}/admin/settings`) ? "nav-link-active" : ""}`} href={`${root}/admin/settings`}><Settings2 size={18} /> 조직 관리</Link>
          </div>
        )}
        {(role === "OWNER" || role === "ADMIN") && (
          <>
            <Link className={`mobile-admin-link nav-link ${active(`${root}/admin/requests`) ? "nav-link-active" : ""}`} href={`${root}/admin/requests`}>
              <ClipboardList size={18} /> 입장 신청
            </Link>
            <Link className={`mobile-admin-link nav-link ${active(`${root}/admin/departments`) ? "nav-link-active" : ""}`} href={`${root}/admin/departments`}>
              <Building2 size={18} /> 부서 관리
            </Link>
            <Link className={`mobile-admin-link nav-link ${active(`${root}/admin/members`) ? "nav-link-active" : ""}`} href={`${root}/admin/members`}>
              <Users size={18} /> 구성원 관리
            </Link>
            <Link className={`mobile-admin-link nav-link ${active(`${root}/admin/settings`) ? "nav-link-active" : ""}`} href={`${root}/admin/settings`}>
              <Settings2 size={18} /> 조직 관리
            </Link>
          </>
        )}
        <div className="sidebar-meta mt-auto border-t border-[var(--line)] pt-3">
          <p className="px-3 py-2 text-sm font-bold">{userName} <span className="badge badge-gray ml-1">{role === "OWNER" ? "소유자" : role === "ADMIN" ? "관리자" : "구성원"}</span></p>
          <SignOutButton />
        </div>
        {showMobileScrollHint && (
          <span className="mobile-scroll-hint" aria-hidden="true">
            <MoveHorizontal size={14} />
            좌우로 밀기
          </span>
        )}
      </aside>
      <section className="app-main">
        <main className="content">{children}</main>
      </section>
    </NavigationLoadingBoundary>
  );
}
