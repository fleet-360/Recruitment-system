"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/settings/lists", label: "רשימות" },
  { href: "/settings/users", label: "משתמשים" },
  { href: "/settings/access", label: "יומן גישה" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-2">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`rounded-full px-4 py-2 text-sm ${path.startsWith(t.href) ? "bg-primary-gradient text-white" : "glass text-slate-600"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
