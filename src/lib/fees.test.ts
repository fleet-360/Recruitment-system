import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelledBy, israelMidnight, planInstallments, splitFee, termsError, totalFee } from "./fees";

test("terms must add up to 100%", () => {
  assert.equal(termsError("fixed", 5000, [{ sharePercent: 50, daysAfterStart: 0 }, { sharePercent: 50, daysAfterStart: 30 }]), null);
  assert.equal(termsError("fixed", 5000, [{ sharePercent: 33.33, daysAfterStart: 0 }, { sharePercent: 33.33, daysAfterStart: 30 }, { sharePercent: 33.34, daysAfterStart: 60 }]), null);
  assert.match(termsError("fixed", 5000, [{ sharePercent: 60, daysAfterStart: 0 }])!, /100%/);
  assert.ok(termsError("fixed", 5000, []));
  assert.ok(termsError("fixed", 0, [{ sharePercent: 100, daysAfterStart: 0 }]));
  assert.ok(termsError("fixed", 5000, [{ sharePercent: 100, daysAfterStart: -1 }]));
  assert.ok(termsError("fixed", 5000, [{ sharePercent: 100, daysAfterStart: 1.5 }]));
});

test("total fee: fixed, or percent of the monthly salary", () => {
  assert.equal(totalFee("fixed", 4000), 4000);
  assert.equal(totalFee("percent_of_salary", 80, 9000), 7200);
  assert.equal(totalFee("percent_of_salary", 80, null), null);
});

test("split adds up to the total exactly", () => {
  const thirds = [{ sharePercent: 33.33, daysAfterStart: 0 }, { sharePercent: 33.33, daysAfterStart: 30 }, { sharePercent: 33.34, daysAfterStart: 60 }];
  const parts = splitFee(1000.01, thirds);
  assert.deepEqual(parts, [333.3, 333.3, 333.41]);
  assert.equal(Math.round(parts.reduce((a, b) => a + b) * 100), 100001);
  assert.deepEqual(splitFee(5000, [{ sharePercent: 100, daysAfterStart: 0 }]), [5000]);
});

test("plan: due dates from the start date, amounts from the salary", () => {
  const start = new Date("2026-10-01");
  const plan = planInstallments(start, "percent_of_salary", 100, 9000, [{ sharePercent: 50, daysAfterStart: 0 }, { sharePercent: 50, daysAfterStart: 60 }])!;
  assert.deepEqual(plan.map((p) => [p.seq, p.dueDate.toISOString().slice(0, 10), p.amount]), [[1, "2026-10-01", 4500], [2, "2026-11-30", 4500]]);
  assert.equal(planInstallments(start, "percent_of_salary", 100, null, [{ sharePercent: 100, daysAfterStart: 0 }]), null);
});

test("cancel only installments due after the cutoff", () => {
  const end = new Date("2026-11-01");
  assert.equal(cancelledBy(new Date("2026-10-15"), end), false); // already owed
  assert.equal(cancelledBy(new Date("2026-11-01"), end), false); // due on the last day — owed
  assert.equal(cancelledBy(new Date("2026-11-30"), end), true);
});

test("israelMidnight is 00:00 in Israel, summer and winter", () => {
  assert.equal(israelMidnight(new Date("2026-09-22T23:30:00Z")).toISOString(), "2026-09-22T21:00:00.000Z"); // 02:30 on the 23rd, IDT
  assert.equal(israelMidnight(new Date("2026-01-10T12:00:00Z")).toISOString(), "2026-01-09T22:00:00.000Z"); // IST
});
