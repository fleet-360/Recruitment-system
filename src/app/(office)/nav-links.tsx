"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users } from "lucide-react";

const items = [
  { href: "/", label: "ראשי", Icon: LayoutGrid },
  { href: "/candidates", label: "מועמדים", Icon: Users },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();

  return (
    <ul className={variant === "bottom" ? "grid grid-flow-col auto-cols-fr gap-1" : "flex gap-1"}>
      {items.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
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
