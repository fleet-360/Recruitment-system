import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// Public SMS removal link (S-15, Communications Law §30A). A button, not a plain GET: link scanners in SMS apps open
// URLs on their own and must not unsubscribe anyone. Shows nothing about the candidate — the link may be forwarded.
export default async function OptOutPage({ params, searchParams }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const done = (await searchParams).done === "1";

  async function optOut() {
    "use server";
    const c = await db.candidate.findUnique({ where: { optOutToken: token }, select: { id: true, marketingConsent: true } });
    if (c?.marketingConsent) {
      await db.$transaction([
        db.candidate.update({ where: { id: c.id }, data: { marketingConsent: false } }),
        db.activity.create({ data: { candidateId: c.id, type: "note", body: "הוסר/ה מרשימת התפוצה דרך קישור ההסרה ב-SMS" } }),
      ]);
    }
    redirect(`/u/${token}?done=1`);
  }

  const valid = done || !!(await db.candidate.findUnique({ where: { optOutToken: token }, select: { id: true } }));

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="glass w-full max-w-sm space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">הסרה מרשימת התפוצה</h1>
        {!valid ? (
          <p className="text-slate-500">הקישור לא תקין.</p>
        ) : done ? (
          <p className="text-emerald-700">הוסרת מרשימת התפוצה. לא יישלחו אליך עוד הודעות פרסומיות.</p>
        ) : (
          <form action={optOut}>
            <p className="mb-4 text-slate-500">לחיצה על הכפתור תסיר אותך מקבלת הודעות SMS פרסומיות מאיתנו.</p>
            <button className="bg-accent-gradient w-full rounded-xl p-3 font-medium text-white">הסירו אותי</button>
          </form>
        )}
      </div>
    </main>
  );
}
