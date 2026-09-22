import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, monthGrid, monthKey, parseMonth } from "./month";

const now = new Date("2026-09-22");

test("parseMonth reads YYYY-MM and falls back to the current month", () => {
  assert.equal(monthKey(parseMonth("2026-02", now)), "2026-02");
  assert.equal(monthKey(parseMonth("2026-13", now)), "2026-09");
  assert.equal(monthKey(parseMonth(undefined, now)), "2026-09");
});

test("addMonths crosses years", () => {
  assert.equal(monthKey(addMonths(parseMonth("2026-12", now), 1)), "2027-01");
  assert.equal(monthKey(addMonths(parseMonth("2026-01", now), -1)), "2025-12");
});

test("monthGrid starts on Sunday and holds every day once", () => {
  const weeks = monthGrid(parseMonth("2026-09", now)); // 1/9/2026 is a Tuesday
  assert.ok(weeks.every((w) => w.length === 7));
  assert.deepEqual(weeks[0].slice(0, 3).map((d) => d?.getUTCDate() ?? null), [null, null, 1]);
  const days = weeks.flat().filter(Boolean);
  assert.equal(days.length, 30);
  assert.equal(days.at(-1)!.getUTCDate(), 30);
});
