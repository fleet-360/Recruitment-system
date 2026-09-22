// Fictional demo data for local testing — never run in production (only with `npm run seed:demo`).
// Every feature step adds its own section here. Phones use the 050-555xxxx range; names are made up.
import type { PrismaClient } from "../src/generated/prisma/client";

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

export async function seedDemo(db: PrismaClient) {
  const admin = await db.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Demo data needs an admin — run with SEED_ADMIN_EMAIL first");
  await seedLists(db);
  await seedCandidates(db, admin.id);
}
