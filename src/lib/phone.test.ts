import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, toIntl } from "./phone";

test("normalizePhone", () => {
  assert.equal(normalizePhone("050-123-4567"), "0501234567");
  assert.equal(normalizePhone("+972 50 123 4567"), "0501234567");
  assert.equal(normalizePhone("972501234567"), "0501234567");
  assert.equal(normalizePhone("501234567"), "0501234567");
  assert.equal(normalizePhone("03-1234567"), "031234567"); // landline, 9 digits
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(toIntl("0501234567"), "972501234567");
});
