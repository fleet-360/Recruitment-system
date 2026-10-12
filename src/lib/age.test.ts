import { test } from "node:test";
import assert from "node:assert/strict";
import { calcAge } from "./age";

const now = new Date("2026-10-12");

test("calcAge counts a full year once the birthday passed this year", () => {
  assert.equal(calcAge(new Date("2000-01-01"), now), 26);
});

test("calcAge subtracts one before this year's birthday arrives", () => {
  assert.equal(calcAge(new Date("2000-12-31"), now), 25);
});

test("calcAge handles the birthday falling exactly today", () => {
  assert.equal(calcAge(new Date("2000-10-12"), now), 26);
});
