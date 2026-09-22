// Initial editable lists (decided 22/09/2026, see Notion → מודל נתונים) + first admin.
// Idempotent: safe to re-run.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import type { ListKey } from "../src/generated/prisma/client";

const lists: Record<ListKey, string[]> = {
  candidate_status: ["התקבל", "בוצעה שיחת טלפון", "נקבע ראיון עבודה", "מבחן אמינות", "התקבל לעבודה"],
  placement_status: ["נשלחו קורות חיים", "ראיונות", "תקופת ניסיון", "התקבל סופית", "נדחה", "פוטר"],
  rejection_reason: ["גיל", "חוסר התאמה לתפקיד", "חוסר התאמה לעסק", "אחר"],
  lead_source: ["דובי הסעות", "קמפיין מטא", "וואטסאפ"],
  language: ["עברית", "ערבית", "רוסית", "אנגלית", "אמהרית", "צרפתית", "ספרדית"],
  region: ["צפון", "חיפה", "שרון", "מרכז", "תל אביב", "שפלה", "ירושלים", "דרום"],
  city: [], // added by the admin from settings, each under a region
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
}

main().finally(() => db.$disconnect());
