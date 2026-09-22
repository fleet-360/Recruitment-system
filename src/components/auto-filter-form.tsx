"use client";

import Form from "next/form";
import { useRef } from "react";
import { X } from "lucide-react";

// GET filter form that applies on change: selects immediately, text inputs after a short typing pause.
export function AutoFilterForm({ action, className, children }: { action: string; className?: string; children: React.ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <Form
      action={action}
      replace // filtering shouldn't pile up history entries
      className={className}
      onChange={(e) => {
        const form = e.currentTarget;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => form.requestSubmit(), e.target instanceof HTMLInputElement ? 400 : 0);
      }}
    >
      {children}
    </Form>
  );
}

// Empties every field of its form (including hidden ones like the status pill) and re-applies.
export function ClearFiltersButton() {
  return (
    <button
      type="button"
      onClick={(e) => {
        const form = e.currentTarget.form!;
        for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) el.value = "";
        form.requestSubmit();
      }}
      className="flex items-center gap-1 rounded-xl px-3 text-sm text-slate-500 hover:bg-white/70 hover:text-red-500"
    >
      <X size={16} /> ניקוי סינון
    </button>
  );
}
