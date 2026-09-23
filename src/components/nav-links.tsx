"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, History, LayoutGrid, Settings, Users, Wallet } from "lucide-react";

const office = [
  { href: "/", label: "ראשי", Icon: LayoutGrid },
  { href: "/candidates", label: "מועמדים", Icon: Users },
  { href: "/companies", label: "חברות", Icon: Building2 },
  { href: "/jobs", label: "משרות", Icon: Briefcase },
  { href: "/collections", label: "גבייה", Icon: Wallet },
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
    <ul className={variant === "bottom" ? "grid grid-flow-col auto-cols-fr gap-1" : "flex gap-1"}>
      {items.filter((i) => isAdmin || !("adminOnly" in i)).map(({ href, label, Icon }) => {
        const active = href === home ? path === home : path.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                variant === "bottom" ? "flex-col text-xs" : ""
              } ${active ? "bg-primary-gradient text-white" : "text-slate-600 hover:bg-white/60"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
