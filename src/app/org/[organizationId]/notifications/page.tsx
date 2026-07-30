import { Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction } from "@/features/actions";
import { listNotifications } from "@/features/queries";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const notifications = await listNotifications(organizationId);
  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Notifications</p><h1 className="page-title mt-1">알림</h1></div><form action={markAllNotificationsReadAction}><input type="hidden" name="organizationId" value={organizationId} /><button className="btn btn-secondary" type="submit"><CheckCheck size={17} /> 모두 읽음</button></form></header>
      <div className="card mt-6 divide-y divide-[var(--line)]">
        {notifications.map((notification) => <article key={notification.id} className={`flex gap-4 p-5 ${notification.readAt ? "" : "bg-emerald-50/45"}`}><span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-full ${notification.readAt ? "bg-slate-100 text-slate-500" : "bg-[var(--brand)] text-white"}`}><Bell size={16} /></span><div><div className="flex items-center gap-2"><h2 className="font-extrabold">{notification.title}</h2>{!notification.readAt && <span className="badge badge-green">새 알림</span>}</div><p className="muted mt-1 text-sm leading-6">{notification.body}</p><time className="muted mt-2 block text-xs">{notification.createdAt.toLocaleString("ko-KR")}</time></div></article>)}
        {!notifications.length && <div className="p-12 text-center"><Bell className="mx-auto text-[var(--brand)]" /><h2 className="mt-3 font-bold">새 알림이 없습니다</h2><p className="muted mt-1 text-sm">중요한 변경 사항이 생기면 이곳에서 알려드릴게요.</p></div>}
      </div>
    </section>
  );
}
