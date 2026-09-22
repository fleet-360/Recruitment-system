import { test } from "node:test";
import assert from "node:assert/strict";
import { splitFee, termsError, totalFee } from "./fees";

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
