"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

type Props = {
  organizationId: string;
  organizationName: string;
  userName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  unreadCount: number;
  children: React.ReactNode;
};

export function AppShell({
  organizationId,
  organizationName,
  userName,
  role,
  unreadCount,
  children,
}: Props) {
  const pathname = usePathname();
  const root = `/org/${organizationId}`;
  const links = [
    { href: `${root}/schedule/week`, label: "주간 일정", icon: CalendarRange },
    { href: `${root}/schedule/month`, label: "월간 일정", icon: CalendarDays },
    { href: `${root}/members`, label: "구성원", icon: Users },
    { href: `${root}/notifications`, label: `알림${unreadCount ? ` ${unreadCount}` : ""}`, icon: Bell },
  ];
  const active = (href: string) => pathname.startsWith(href);

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="sidebar-brand mb-5 flex items-center gap-3 px-2 py-2">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand)] text-white"><CalendarDays size={20} /></span>
          <span className="font-extrabold tracking-[-.03em]">조직 일정 관리</span>
        </div>
        <Link href="/organizations" className="sidebar-meta card mb-5 flex items-center justify-between gap-2 p-3">
          <span className="min-w-0">
            <span className="muted block text-[.68rem] font-bold">현재 조직</span>
            <span className="block truncate text-sm font-bold">{organizationName}</span>
          </span>
          <ChevronDown size={16} className="muted shrink-0" />
        </Link>
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
            <Link className={`nav-link ${active(`${root}/admin/requests`) ? "nav-link-active" : ""}`} href={`${root}/admin/requests`}><ClipboardList size={18} /> 가입 신청</Link>
            <Link className={`nav-link ${active(`${root}/admin/departments`) ? "nav-link-active" : ""}`} href={`${root}/admin/departments`}><Building2 size={18} /> 부서 관리</Link>
            <Link className={`nav-link ${active(`${root}/admin/members`) ? "nav-link-active" : ""}`} href={`${root}/admin/members`}><Settings2 size={18} /> 조직 관리</Link>
          </div>
        )}
        <div className="sidebar-meta mt-auto border-t border-[var(--line)] pt-3">
          <p className="px-3 py-2 text-sm font-bold">{userName} <span className="badge badge-gray ml-1">{role === "OWNER" ? "소유자" : role === "ADMIN" ? "관리자" : "구성원"}</span></p>
          <SignOutButton />
        </div>
      </aside>
      <section className="app-main">
        <header className="topbar no-print">
          <div>
            <p className="muted text-xs font-bold">조직</p>
            <p className="font-extrabold tracking-[-.02em]">{organizationName}</p>
          </div>
          <Link className="btn btn-primary" href={`${root}/schedule/week?new=1`}>
            <Plus size={17} /> <span className="hidden sm:inline">일정 추가</span>
          </Link>
        </header>
        <main className="content">{children}</main>
      </section>
    </div>
  );
}
