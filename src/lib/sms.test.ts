import { test } from "node:test";
import assert from "node:assert/strict";
import { newOptOutToken, smsSegments, withOptOut } from "./sms";

test("smsSegments: Hebrew is billed per 70 / 67 chars, Latin per 160 / 153", () => {
  assert.equal(smsSegments("א".repeat(70)), 1);
  assert.equal(smsSegments("א".repeat(71)), 2);
  assert.equal(smsSegments("א".repeat(134)), 2);
  assert.equal(smsSegments("א".repeat(135)), 3);
  assert.equal(smsSegments("a".repeat(160)), 1);
  assert.equal(smsSegments("a".repeat(161)), 2);
});

test("withOptOut appends the removal link on its own line", () => {
  const token = newOptOutToken();
  assert.equal(token.length, 8);
  assert.match(withOptOut("  שלום ", token), new RegExp(`^שלום\\nלהסרה: https?://.+/u/${token}$`));
});
