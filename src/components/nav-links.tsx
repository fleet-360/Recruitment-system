"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, CalendarDays, ChartColumn, History, LayoutGrid, ListTodo, Settings, Users, Wallet } from "lucide-react";

const office = [
  { href: "/", label: "ראשי", Icon: LayoutGrid },
  { href: "/candidates", label: "מועמדים", Icon: Users },
  { href: "/tasks", label: "משימות", Icon: ListTodo },
  { href: "/interviews", label: "יומן", Icon: CalendarDays },
  { href: "/companies", label: "חברות", Icon: Building2 },
  { href: "/jobs", label: "משרות", Icon: Briefcase },
  { href: "/collections", label: "גבייה", Icon: Wallet },
  { href: "/reports", label: "דוחות", Icon: ChartColumn },
  { href: "/settings", label: "הגדרות", Icon: Settings, adminOnly: true },
];

const portal = [
  { href: "/portal", label: "ראשי", Icon: LayoutGrid },
  { href: "/portal/jobs", label: "משרות", Icon: Briefcase },
  { href: "/portal/candidates", label: "מועמדים", Icon: Users },
  { href: "/portal/history", label: "היסטוריה", Icon: History },
  { href: "/portal/profile", label: "פרופיל", Icon: Building2 },
];

export function NavLinks({ variant, isAdmin = false, area = "office" }: { variant: "top" | "bottom"; isAdmin?: boolean; area?: "office" | "portal" }) {
  const path = usePathname();
  const items = area === "portal" ? portal : office;
  const home = items[0].href;

  return (
    // bottom: at least 4rem per item and scroll sideways when they don't fit (the office menu has 8 for an admin)
    <ul className={variant === "bottom" ? "grid grid-flow-col auto-cols-[minmax(4rem,1fr)] gap-1 overflow-x-auto [scrollbar-width:none]" : "flex gap-1"}>
      {items.filter((i) => isAdmin || !("adminOnly" in i)).map(({ href, label, Icon }) => {
        const active = href === home ? path === home : path.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm ${
                variant === "bottom" ? "flex-col px-1 text-xs whitespace-nowrap" : "px-3"
              } ${active ? "bg-primary-gradient text-white" : "text-slate-600 hover:bg-white/60"}`}
            >
              <Icon size={18} />
              {/* top: icons only on tablets, labels from lg — 8 office items don't fit at 768px */}
              <span className={variant === "top" && area === "office" ? "sr-only lg:not-sr-only" : ""}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
