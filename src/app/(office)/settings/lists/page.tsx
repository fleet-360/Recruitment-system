import Link from "next/link";
import { ChevronDown, ChevronUp, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getList, listNames, withCurrent } from "@/lib/lookups";
import { ListKey } from "@/generated/prisma/client";
import { move, toggleActive } from "./actions";
import { AddValueForm, EditValueForm } from "./value-forms";

const hints: Partial<Record<ListKey, string>> = {
  candidate_status: "הסדר כאן הוא סדר השלבים בסטפר. הערך הראשון ניתן אוטומטית למועמד חדש.",
  placement_status: "הסדר כאן הוא סדר השלבים בתהליך ההשמה. \"נדחה\" ו\"פוטר\" נקבעים מחלון הדחייה/הסיום בהשמה ולא מהסטפר.",
  rejection_reason: "\"דורש פירוט\" מחייב טקסט חופשי בעת דחייה.",
  city: "כל עיר משויכת לאזור — הפילוח בתפוצה ובסינון מתבסס על זה.",
};

// S-17 editable lists (admin only). Values are deactivated, never deleted.
export default async function ListsSettingsPage({ searchParams }: PageProps<"/settings/lists">) {
  await requireAdmin();
  const sp = await searchParams;
  const listKey = Object.values(ListKey).includes(sp.list as ListKey) ? (sp.list as ListKey) : ListKey.candidate_status;
  const isCity = listKey === "city";

  const [values, regions] = await Promise.all([
    db.lookupValue.findMany({
      where: { listKey },
      // cities: grouped by region, alphabetical; everything else: the admin's order
      orderBy: isCity ? [{ parent: { label: "asc" } }, { label: "asc" }] : [{ sortOrder: "asc" }, { label: "asc" }],
      include: { parent: { select: { label: true } } },
    }),
    getList("region"),
  ]);

  return (
    <>
      <section className="glass flex items-center gap-4 p-5">
        <span className="bg-accent-gradient flex size-12 items-center justify-center rounded-2xl text-white">
          <ListChecks size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold">הגדרות · רשימות</h1>
          <p className="text-sm text-slate-500">עריכת הערכים שמופיעים בבחירות במערכת</p>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {Object.values(ListKey).map((key) => (
          <Link
            key={key}
            href={`/settings/lists?list=${key}`}
            replace
            className={`shrink-0 rounded-xl px-3 py-2 text-sm ${key === listKey ? "bg-accent-gradient text-white" : "glass text-slate-600"}`}
          >
            {listNames[key]}
          </Link>
        ))}
      </nav>

      <section className="glass space-y-3 p-4">
        {hints[listKey] && <p className="text-sm text-slate-500">{hints[listKey]}</p>}

        <ul className="divide-y divide-slate-100">
          {values.map((v, i) => (
            <li key={v.id} className={`flex flex-wrap items-center gap-2 py-2 ${v.isActive ? "" : "opacity-60"}`}>
              {!isCity && (
                <div className="flex flex-col">
                  <form action={move.bind(null, v.id, "up")}>
                    <button disabled={i === 0} aria-label="הזזה למעלה" className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:invisible">
                      <ChevronUp size={16} />
                    </button>
                  </form>
                  <form action={move.bind(null, v.id, "down")}>
                    <button disabled={i === values.length - 1} aria-label="הזזה למטה" className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:invisible">
                      <ChevronDown size={16} />
                    </button>
                  </form>
                </div>
              )}
              <EditValueForm value={v} listKey={listKey} regions={v.parent && v.parentId ? withCurrent(regions, { id: v.parentId, label: v.parent.label }) : regions} />
              {!v.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">לא פעיל</span>}
              {v.systemKey ? (
                <span className="px-3 text-xs text-slate-400" title="המערכת משתמשת בערך הזה — אפשר לשנות את שמו, לא להשבית">ערך מערכת</span>
              ) : (
                <form action={toggleActive.bind(null, v.id)}>
                  <button
                    className={`rounded-xl px-3 py-2 text-sm ${v.isActive ? "text-slate-500 hover:bg-red-50 hover:text-red-600" : "text-emerald-700 hover:bg-emerald-50"}`}
                  >
                    {v.isActive ? "השבתה" : "הפעלה"}
                  </button>
                </form>
              )}
            </li>
          ))}
          {values.length === 0 && <li className="py-6 text-center text-sm text-slate-400">הרשימה ריקה</li>}
        </ul>

        <div className="border-t border-slate-200/70 pt-3">
          <AddValueForm listKey={listKey} regions={regions} />
        </div>
      </section>
    </>
  );
}
