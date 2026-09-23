import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { markAllRead, openNotification } from "./notification-actions";

// Native popover: closes on outside click / Esc with no client JS.
export async function NotificationBell({ userId }: { userId: string }) {
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    // ponytail: last 20 only, a full notifications page if they pile up
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <>
      <button popoverTarget="notifications" className="relative ms-auto text-slate-500 hover:text-violet-700" title="התראות" aria-label={`התראות${unread ? ` (${unread} חדשות)` : ""}`}>
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-2 -end-2 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <div id="notifications" popover="auto" className="glass fixed inset-x-3 top-20 bottom-auto m-0 max-h-[70vh] overflow-y-auto p-3 md:right-auto md:left-4 md:w-96">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">התראות</h2>
          {unread > 0 && (
            <form action={markAllRead}>
              <button className="text-xs text-violet-700 hover:underline">סמן הכל כנקרא</button>
            </form>
          )}
        </div>
        {items.length === 0 && <p className="py-6 text-center text-sm text-slate-500">אין התראות</p>}
        <ul className="space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <form action={openNotification.bind(null, n.id)}>
                <button className={`w-full rounded-xl p-2 text-start text-sm hover:bg-white/70 ${n.readAt ? "text-slate-500" : "bg-violet-50 font-medium"}`}>
                  {n.message}
                  <span className="block text-xs font-normal text-slate-400">{n.createdAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" })}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
