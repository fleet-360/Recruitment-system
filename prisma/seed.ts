// Initial editable lists (decided 22/09/2026, see Notion → מודל נתונים) + first admin.
// Idempotent: safe to re-run.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import type { ListKey } from "../src/generated/prisma/client";
import { seedDemo } from "./demo";

const lists: Record<ListKey, string[]> = {
  candidate_status: ["התקבל", "בוצעה שיחת טלפון", "נקבע ראיון עבודה", "מבחן אמינות", "התקבל לעבודה"],
  placement_status: ["נשלחו קורות חיים", "ראיונות", "תקופת ניסיון", "התקבל סופית", "נדחה", "פוטר"],
  rejection_reason: ["גיל", "חוסר התאמה לתפקיד", "חוסר התאמה לעסק", "אחר"],
  lead_source: ["דובי הסעות", "קמפיין מטא", "וואטסאפ"],
  language: ["עברית", "ערבית", "רוסית", "אנגלית", "אמהרית", "צרפתית", "ספרדית"],
  region: ["צפון", "חיפה", "שרון", "מרכז", "תל אביב", "שפלה", "ירושלים", "דרום"],
  city: [], // seeded below, each under its region; more are added from settings
};

// Starter cities (real reference data, not demo). region → cities
const cities: Record<string, string[]> = {
  צפון: ["נצרת", "עפולה", "כרמיאל", "טבריה", "נהריה"],
  חיפה: ["חיפה", "חדרה", "קריית אתא"],
  שרון: ["נתניה", "כפר סבא", "רעננה", "הרצליה"],
  מרכז: ["פתח תקווה", "ראש העין", "מודיעין", "רחובות"],
  "תל אביב": ["תל אביב-יפו", "רמת גן", "חולון", "בת ים"],
  שפלה: ["ראשון לציון", "אשדוד", "בית שמש"],
  ירושלים: ["ירושלים", "מבשרת ציון"],
  דרום: ["באר שבע", "אשקלון", "אילת", "דימונה"],
};

async function main() {
  for (const [listKey, labels] of Object.entries(lists) as [ListKey, string[]][]) {
    for (const [sortOrder, label] of labels.entries()) {
      await db.lookupValue.upsert({
        where: { listKey_label: { listKey, label } },
        update: {},
        create: { listKey, label, sortOrder, requiresNote: listKey === "rejection_reason" && label === "אחר" },
      });
    }
  }

  for (const [region, names] of Object.entries(cities)) {
    const parent = await db.lookupValue.findUniqueOrThrow({ where: { listKey_label: { listKey: "region", label: region } } });
    for (const label of names) {
      await db.lookupValue.upsert({
        where: { listKey_label: { listKey: "city", label } },
        update: {},
        create: { listKey: "city", label, parentId: parent.id },
      });
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  if (email) {
    const password = process.env.SEED_ADMIN_PASSWORD;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    await db.user.upsert({
      where: { email },
      update: passwordHash ? { passwordHash } : {}, // re-run with a password to set/reset it
      create: { email, role: "admin", passwordHash },
    });
    console.log(`admin: ${email}`);
  }

  if (process.argv.includes("--demo")) await seedDemo(db); // npm run seed:demo
}

main().finally(() => db.$disconnect());
