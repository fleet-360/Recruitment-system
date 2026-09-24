"use client";

import { UserX } from "lucide-react";
import { anonymizeCandidate } from "../actions";

export function AnonymizeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={anonymizeCandidate.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`למחוק את הנתונים האישיים של ${name}?\nיימחקו שם, טלפון, אימייל, תאריך לידה, תקציר, הערות וקורות חיים. ההשמות והגבייה יישארו בלי פרטים מזהים.\nלא ניתן לשחזר.`)) e.preventDefault();
      }}
    >
      <button className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm text-red-600 shadow-sm hover:bg-red-50">
        <UserX size={16} /> מחיקת נתונים אישיים
      </button>
    </form>
  );
}
