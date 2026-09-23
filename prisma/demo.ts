// Fictional demo data for local testing — never run in production (only with `npm run seed:demo`).
// Every feature step adds its own section here. Phones use the 050-555xxxx range; names are made up.
import type { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { addDays, cancelledBy, fromIsraelLocal, planInstallments, today, type FeeType } from "../src/lib/fees";
import { notifyOffice, notifyOverdue } from "../src/lib/notifications";
import { openOverdueTasks } from "../src/lib/tasks";

const DAY = 86_400_000;

async function lookup(db: PrismaClient, listKey: "candidate_status" | "lead_source" | "language" | "city", label: string) {
  return db.lookupValue.findUniqueOrThrow({ where: { listKey_label: { listKey, label } } });
}

// ───── Step: candidates
const candidates = [
  { fullName: "נועה לוי", phone: "0505550101", city: "חיפה", status: "התקבל", source: "דובי הסעות", languages: ["עברית", "אנגלית"], daysAgo: 1 },
  { fullName: "מוחמד חסן", phone: "0505550102", city: "נצרת", status: "בוצעה שיחת טלפון", source: "דובי הסעות", languages: ["ערבית", "עברית"], daysAgo: 3 },
  { fullName: "יוליה פטרוב", phone: "0505550103", city: "אשדוד", status: "נקבע ראיון עבודה", source: "קמפיין מטא", languages: ["רוסית", "עברית"], daysAgo: 6 },
  { fullName: "אבי כהן", phone: "0505550104", city: "תל אביב-יפו", status: "מבחן אמינות", source: "וואטסאפ", languages: ["עברית"], daysAgo: 9 },
  { fullName: "תגסט אבבה", phone: "0505550105", city: "נתניה", status: "התקבל לעבודה", source: "דובי הסעות", languages: ["אמהרית", "עברית"], daysAgo: 14 },
  { fullName: "שירה מזרחי", phone: "0505550106", city: "באר שבע", status: "התקבל", source: "קמפיין מטא", languages: ["עברית", "צרפתית"], daysAgo: 0 },
  { fullName: "אחמד עודה", phone: "0505550107", city: "חיפה", status: "בוצעה שיחת טלפון", source: "וואטסאפ", languages: ["ערבית"], daysAgo: 2 },
  { fullName: "דניאל גרין", phone: "0505550108", city: "ירושלים", status: "נקבע ראיון עבודה", source: "קמפיין מטא", languages: ["אנגלית", "עברית"], daysAgo: 5 },
  { fullName: "מריה גונזלס", phone: "0505550109", city: "רמת גן", status: "התקבל", source: "דובי הסעות", languages: ["ספרדית", "עברית"], daysAgo: 1 },
  { fullName: "יוסי ביטון", phone: "0505550110", city: "אשקלון", status: "מבחן אמינות", source: "דובי הסעות", languages: ["עברית"], daysAgo: 11 },
  { fullName: "רנא חורי", phone: "0505550111", city: "נצרת", status: "התקבל לעבודה", source: "קמפיין מטא", languages: ["ערבית", "עברית", "אנגלית"], daysAgo: 20 },
  { fullName: "איגור סמירנוב", phone: "0505550112", city: "אשדוד", status: "התקבל", source: "וואטסאפ", languages: ["רוסית"], daysAgo: 0 },
];

async function seedCandidates(db: PrismaClient, adminId: string) {
  const statuses = await db.lookupValue.findMany({ where: { listKey: "candidate_status" }, orderBy: { sortOrder: "asc" } });

  for (const c of candidates) {
    if (await db.candidate.findUnique({ where: { phone: c.phone } })) continue; // idempotent
    const [city, status, source] = await Promise.all([
      lookup(db, "city", c.city),
      lookup(db, "candidate_status", c.status),
      lookup(db, "lead_source", c.source),
    ]);
    const languages = await Promise.all(c.languages.map((l) => lookup(db, "language", l)));
    const createdAt = new Date(Date.now() - c.daysAgo * DAY);

    // Status history: one status_change per step walked, spread over the candidate's age.
    const walked = statuses.slice(0, statuses.findIndex((s) => s.id === status.id) + 1);
    const history = walked.slice(1).map((s, i) => ({
      type: "status_change" as const,
      userId: adminId,
      fromValue: walked[i].label,
      toValue: s.label,
      createdAt: new Date(createdAt.getTime() + ((i + 1) * (c.daysAgo * DAY)) / walked.length),
    }));

    await db.candidate.create({
      data: {
        fullName: c.fullName,
        phone: c.phone,
        cityId: city.id,
        statusId: status.id,
        sourceId: source.id,
        ownerUserId: adminId,
        summary: `מועמד/ת דמו. דובר/ת ${c.languages.join(", ")}, גר/ה ב${c.city}.`,
        marketingConsent: c.phone.endsWith("1") || c.phone.endsWith("5"),
        createdAt,
        languages: { create: languages.map((l) => ({ languageId: l.id })) },
        activities: {
          create: [{ type: "note", userId: adminId, body: "פנה/תה לראשונה — נתוני דמו", createdAt }, ...history],
        },
        tasks: { create: { title: "פולואפ ראשוני", dueAt: createdAt, assignedToId: adminId } },
      },
    });
  }
  console.log(`demo: ${candidates.length} candidates`);
}

// ───── Step: settings lists — one retired value so the "לא פעיל" state shows up
async function seedLists(db: PrismaClient) {
  await db.lookupValue.upsert({
    where: { listKey_label: { listKey: "lead_source", label: "עיתון מקומי" } },
    update: {},
    create: { listKey: "lead_source", label: "עיתון מקומי", sortOrder: 99, isActive: false },
  });
  console.log("demo: 1 inactive lead source");
}

// ───── Step: companies, branches, payment terms, jobs
type DemoBranch = {
  name: string;
  city: string;
  fee?: { type: "fixed" | "percent_of_salary"; value: number; terms: [share: number, days: number][] };
  jobs?: { title: string; salary?: number; openings?: number; closed?: boolean }[];
};
const companies: { name: string; regNumber: string; contacts: { name: string; role: string; phone: string; branch?: string }[]; branches: DemoBranch[] }[] = [
  {
    name: "לוגיסטיקה צפונית בע״מ",
    regNumber: "515550001",
    contacts: [
      { name: "רונית אבוטבול", role: "מנהלת משאבי אנוש", phone: "0505550201" },
      { name: "סאמר חביב", role: "מנהל מחסן", phone: "0505550202", branch: "סניף נצרת" },
    ],
    branches: [
      { name: "מרכז הפצה חיפה", city: "חיפה", fee: { type: "percent_of_salary", value: 100, terms: [[50, 0], [50, 60]] },
        jobs: [{ title: "מלקט/ת במחסן", salary: 7500, openings: 5 }, { title: "מנהל/ת משמרת", salary: 11000, closed: true }] },
      { name: "סניף נצרת", city: "נצרת", fee: { type: "fixed", value: 4000, terms: [[100, 30]] },
        jobs: [{ title: "נהג/ת מלגזה", salary: 9000, openings: 2 }] },
    ],
  },
  {
    name: "רשת קפה בוקר טוב",
    regNumber: "515550002",
    contacts: [{ name: "עדי שמש", role: "בעלים", phone: "0505550203" }],
    branches: [
      { name: "ראשי", city: "תל אביב-יפו", fee: { type: "fixed", value: 2500, terms: [[33.33, 0], [33.33, 30], [33.34, 60]] },
        jobs: [{ title: "בריסטה", salary: 6500, openings: 3 }] },
      { name: "רמת גן", city: "רמת גן", jobs: [{ title: "אחראי/ת משמרת", salary: 8000 }] }, // no terms — edge case
    ],
  },
  {
    name: "מלונות ים התכלת",
    regNumber: "515550003",
    contacts: [{ name: "גלעד פרץ", role: "מנהל כוח אדם", phone: "0505550204" }],
    branches: [
      { name: "מלון אילת", city: "אילת", fee: { type: "percent_of_salary", value: 80, terms: [[100, 90]] },
        jobs: [{ title: "חדרן/ית", salary: 7000, openings: 8 }, { title: "פקיד/ת קבלה", salary: 8500, closed: true }] },
    ],
  },
  { name: "טכנו-פלסט תעשיות", regNumber: "515550004", contacts: [], branches: [{ name: "ראשי", city: "באר שבע" }] }, // no jobs yet
];

async function seedCompanies(db: PrismaClient, adminId: string) {
  for (const c of companies) {
    if (await db.company.findFirst({ where: { regNumber: c.regNumber } })) continue; // idempotent
    const company = await db.company.create({ data: { name: c.name, regNumber: c.regNumber, notes: "חברת דמו" } });
    const branchIds: Record<string, string> = {};
    for (const b of c.branches) {
      const city = await lookup(db, "city", b.city);
      const branch = await db.branch.create({
        data: {
          companyId: company.id,
          name: b.name,
          cityId: city.id,
          feeType: b.fee?.type,
          feeValue: b.fee?.value,
          paymentTerms: b.fee && { create: b.fee.terms.map(([sharePercent, daysAfterStart], i) => ({ seq: i + 1, sharePercent, daysAfterStart })) },
        },
      });
      branchIds[b.name] = branch.id;
      for (const j of b.jobs ?? []) {
        await db.job.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            title: j.title,
            salary: j.salary,
            openings: j.openings ?? 1,
            status: j.closed ? "closed" : "open",
            description: "משרת דמו",
            createdById: adminId,
          },
        });
      }
    }
    await db.contact.createMany({
      data: c.contacts.map((ct) => ({ companyId: company.id, name: ct.name, role: ct.role, phone: ct.phone, branchId: ct.branch ? branchIds[ct.branch] : null })),
    });
  }
  console.log(`demo: ${companies.length} companies with branches, terms and jobs`);
}

// ───── Step: placements + installments — one per stage, plus the edge cases
const placements: { phone: string; job: string; status: string; startDaysAgo?: number; endDaysAgo?: number; reason?: string }[] = [
  { phone: "0505550101", job: "בריסטה", status: "נשלחו קורות חיים" },
  { phone: "0505550102", job: "מלקט/ת במחסן", status: "ראיונות" },
  { phone: "0505550105", job: "מלקט/ת במחסן", status: "תקופת ניסיון", startDaysAgo: 20 }, // % of salary: 1st installment overdue
  { phone: "0505550111", job: "נהג/ת מלגזה", status: "התקבל סופית", startDaysAgo: 45 }, // fixed fee
  { phone: "0505550104", job: "חדרן/ית", status: "פוטר", startDaysAgo: 60, endDaysAgo: 10, reason: "עזב אחרי חודשיים" }, // future installment cancelled
  { phone: "0505550103", job: "בריסטה", status: "נדחה", reason: "חוסר התאמה לתפקיד" },
  { phone: "0505550108", job: "אחראי/ת משמרת", status: "תקופת ניסיון", startDaysAgo: 5 }, // branch has no terms → no installments
];

async function seedPlacements(db: PrismaClient, adminId: string) {
  for (const d of placements) {
    const [candidate, job] = await Promise.all([
      db.candidate.findUniqueOrThrow({ where: { phone: d.phone } }),
      db.job.findFirstOrThrow({ where: { title: d.job, description: "משרת דמו" }, include: { branch: { include: { paymentTerms: { orderBy: { seq: "asc" } } } } } }),
    ]);
    if (await db.placement.findUnique({ where: { candidateId_jobId: { candidateId: candidate.id, jobId: job.id } } })) continue; // idempotent
    const status = await db.lookupValue.findUniqueOrThrow({ where: { listKey_label: { listKey: "placement_status", label: d.status } } });
    const reason = d.status === "נדחה" ? await db.lookupValue.findUniqueOrThrow({ where: { listKey_label: { listKey: "rejection_reason", label: d.reason! } } }) : null;

    const startDate = d.startDaysAgo !== undefined ? addDays(today(), -d.startDaysAgo) : null;
    const endDate = d.endDaysAgo !== undefined ? addDays(today(), -d.endDaysAgo) : null;
    const salary = job.salary ? Number(job.salary) : null;
    const b = job.branch;
    const plan =
      startDate && b.feeType
        ? planInstallments(startDate, b.feeType as FeeType, Number(b.feeValue), salary, b.paymentTerms.map((t) => ({ sharePercent: Number(t.sharePercent), daysAfterStart: t.daysAfterStart })))
        : null;

    await db.placement.create({
      data: {
        candidateId: candidate.id,
        jobId: job.id,
        statusId: status.id,
        rejectionReasonId: reason?.id,
        startDate,
        endDate,
        endReason: endDate ? d.reason : null,
        salary: startDate ? salary : null,
        feeType: plan ? b.feeType : null,
        feeValue: plan ? b.feeValue : null,
        installments: plan
          ? { create: plan.map((i) => ({ ...i, status: endDate && cancelledBy(i.dueDate, endDate) ? ("cancelled" as const) : ("expected" as const) })) }
          : undefined,
        activities: {
          create: [
            { candidateId: candidate.id, userId: adminId, type: "status_change", toValue: d.status, body: reason?.label ?? d.reason },
            ...(plan ? [{ candidateId: candidate.id, userId: adminId, type: "billing" as const, body: `נוצרו ${plan.length} פעימות (דמו)` }] : []),
          ],
        },
      },
    });
  }
  console.log(`demo: ${placements.length} placements`);
}

// ───── Step: collections — pay the installments whose due date passed, except the ones meant to stay overdue
const leaveOverdue = ["0505550105"]; // % of salary placement: 1st installment stays late

async function seedCollections(db: PrismaClient) {
  const due = await db.installment.findMany({
    where: { status: "expected", dueDate: { lt: today() }, placement: { job: { description: "משרת דמו" }, candidate: { phone: { notIn: leaveOverdue } } } },
  });
  for (const i of due) {
    const paidAt = addDays(i.dueDate, 3) < today() ? addDays(i.dueDate, 3) : today(); // paid a few days late, like real life
    await db.installment.update({ where: { id: i.id }, data: { status: "paid", paidAt } });
  }
  console.log(`demo: ${due.length} installments marked paid`); // idempotent: paid ones no longer match
}

// ───── Step: users — one per role besides admin. Password "demo1234", no forced change (demo only).
const demoUsers = [
  { email: "recruiter@example.com", name: "מיכל רכזת", role: "recruiter" as const },
  { email: "company@example.com", name: "יוסי מנהל חברה", role: "company_admin" as const, company: "לוגיסטיקה צפונית בע״מ" },
  { email: "branch@example.com", name: "דנה מנהלת סניף", role: "branch_manager" as const, company: "רשת קפה בוקר טוב", branches: ["ראשי"] },
];

async function seedUsers(db: PrismaClient) {
  const passwordHash = await bcrypt.hash("demo1234", 12);
  for (const u of demoUsers) {
    if (await db.user.findUnique({ where: { email: u.email } })) continue; // idempotent
    const company = u.company ? await db.company.findFirstOrThrow({ where: { name: u.company }, include: { branches: true } }) : null;
    await db.user.create({
      data: {
        email: u.email, name: u.name, role: u.role, passwordHash, companyId: company?.id,
        branches: { create: (company?.branches ?? []).filter((b) => u.branches?.includes(b.name)).map((b) => ({ branchId: b.id })) },
      },
    });
  }
  console.log(`demo: ${demoUsers.length} users (password demo1234)`);
}

// ───── Step: notifications — run the daily job once so the bell shows the overdue installment
async function seedNotifications(db: PrismaClient) {
  console.log(`demo: ${await notifyOverdue(db)} overdue notifications`); // idempotent: each installment is notified once
}

// ───── Step: business portal — a job the branch manager opened in the portal, with the office notification it sends
async function seedPortal(db: PrismaClient) {
  const manager = await db.user.findUniqueOrThrow({ where: { email: "branch@example.com" }, include: { branches: true } });
  const title = "בריסטה למשמרות ערב";
  if (await db.job.findFirst({ where: { title, createdById: manager.id } })) return; // idempotent
  const branch = await db.branch.findUniqueOrThrow({ where: { id: manager.branches[0].branchId }, include: { company: true } });
  const job = await db.job.create({
    data: { title, description: "משרת דמו מהפורטל — ערבים וסופי שבוע", salary: 7500, openings: 2, companyId: branch.companyId, branchId: branch.id, createdById: manager.id },
  });
  await notifyOffice(db, [{ type: "job_opened", entityType: "job", entityId: job.id, message: `משרה חדשה מהפורטל: ${title} — ${branch.company.name} · ${branch.name}` }]);
  console.log("demo: 1 portal job + office notification");
}

// ───── Step: tasks — a few by hand in every bucket, old follow-ups done, and the daily job's collection task
const demoTasks = [
  { title: "לשלוח קו״ח למנהלת הסניף", candidate: "0505550103", days: 0, to: "recruiter@example.com" },
  { title: "לתאם ראיון שני", candidate: "0505550108", days: 2 },
  { title: "לבדוק איך עבר השבוע הראשון", candidate: "0505550105", days: -2 },
  { title: "להתקשר ללוגיסטיקה צפונית על משרות לחורף", days: 0 },
  { title: "לעדכן מועמדים דוברי רוסית על משרה חדשה", days: 5, to: "recruiter@example.com" },
];

async function seedTasks(db: PrismaClient, adminId: string) {
  // follow-ups of candidates older than 3 days were done a day after they came in
  const old = await db.task.findMany({ where: { title: "פולואפ ראשוני", doneAt: null, dueAt: { lt: addDays(new Date(), -3) } } });
  for (const t of old) await db.task.update({ where: { id: t.id }, data: { doneAt: addDays(t.dueAt, 1) } });
  for (const t of demoTasks) {
    if (await db.task.findFirst({ where: { title: t.title } })) continue; // idempotent
    const candidate = t.candidate ? await db.candidate.findUniqueOrThrow({ where: { phone: t.candidate } }) : null;
    const assignee = t.to ? await db.user.findUniqueOrThrow({ where: { email: t.to } }) : null;
    await db.task.create({ data: { title: t.title, dueAt: addDays(today(), t.days), candidateId: candidate?.id, assignedToId: assignee?.id ?? adminId } });
  }
  console.log(`demo: ${demoTasks.length} tasks, ${old.length} follow-ups done, ${await openOverdueTasks(db)} collection tasks`);
}

// ───── Step: interviews — this week, one today; office screenings and one for a placement
const demoInterviews = [
  { candidate: "0505550103", days: 0, time: "11:00", location: "משרד — חדר ישיבות", forPlacement: false },
  { candidate: "0505550108", days: 1, time: "09:30", location: "זום", forPlacement: false },
  { candidate: "0505550102", days: 2, time: "14:00", location: "בסניף", forPlacement: true },
  { candidate: "0505550107", days: 5, time: "10:15", location: null, forPlacement: false },
];

async function seedInterviews(db: PrismaClient) {
  if (await db.interview.count()) return console.log("demo: interviews already there"); // idempotent — dates are relative to the first run
  for (const i of demoInterviews) {
    const candidate = await db.candidate.findUniqueOrThrow({ where: { phone: i.candidate }, include: { placements: { take: 1 } } });
    const scheduledAt = fromIsraelLocal(`${addDays(today(), i.days).toISOString().slice(0, 10)}T${i.time}`);
    await db.interview.create({ data: { candidateId: candidate.id, scheduledAt, location: i.location, placementId: i.forPlacement ? candidate.placements[0]?.id : null } });
  }
  console.log(`demo: ${demoInterviews.length} interviews`);
}

export async function seedDemo(db: PrismaClient) {
  const admin = await db.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Demo data needs an admin — run with SEED_ADMIN_EMAIL first");
  await seedLists(db);
  await seedCandidates(db, admin.id);
  await seedCompanies(db, admin.id);
  await seedPlacements(db, admin.id);
  await seedCollections(db);
  await seedUsers(db);
  await seedNotifications(db);
  await seedPortal(db);
  await seedTasks(db, admin.id);
  await seedInterviews(db);
}
