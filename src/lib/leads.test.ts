import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leadAnswers, parseLeads, readSheet } from "./leads";

test("xlsx export: shared strings, numeric phone, prefixes, gaps, rows without id", () => {
  const leads = parseLeads(readSheet(readFileSync(new URL("./fixtures/meta-leads.xlsx", import.meta.url))))!;
  assert.equal(leads.length, 2);
  assert.equal(leads[0].metaLeadId, "1111111111");
  assert.equal(leads[0].phone, "0505550101");
  assert.equal(leads[0].email, "noa@example.com");
  assert.equal(leads[0].campaign, "גיוס מחסנאים ספטמבר");
  assert.equal(leads[0].receivedAt.toISOString(), "2026-09-20T07:15:30.000Z");
  assert.deepEqual(leadAnswers(leads[0].raw), [["באיזו עיר את/ה גר/ה?", "חולון"]]);
  assert.equal(leads[1].fullName, "דן & בדוי");
  assert.equal(leads[1].phone, "0505550102");
  assert.equal(leads[1].email, null);
});

test("Meta CSV: UTF-16 with BOM, tab-separated", () => {
  const text = "id\tcreated_time\tfirst_name\tlast_name\tphone_number\nl:33\t2026-09-22T12:00:00+03:00\tרון\tבדוי\tp:+972505550104\n";
  const leads = parseLeads(readSheet(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")])))!;
  assert.deepEqual(
    { id: leads[0].metaLeadId, name: leads[0].fullName, phone: leads[0].phone },
    { id: "33", name: "רון בדוי", phone: "0505550104" },
  );
});

test("UTF-8 CSV with quotes; invalid phone kept as received; no id column → null", () => {
  const csv = '﻿id,full_name,phone_number,הערות\r\n44,"כהן, רותי",123,"שורה ""אחת""\nושתיים"\r\n';
  const [lead] = parseLeads(readSheet(Buffer.from(csv)))!;
  assert.equal(lead.fullName, "כהן, רותי");
  assert.equal(lead.phone, "123");
  assert.equal(lead.raw["הערות"], 'שורה "אחת"\nושתיים');
  assert.equal(parseLeads(readSheet(Buffer.from("name,phone\nא,050\n"))), null);
});
