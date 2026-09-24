import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FAILS, WINDOW_MS, clearFails, isLocked, recordFail } from "./login-limit";

test("locks after MAX_FAILS, unlocks after the window, clears on success", () => {
  const t = 1_000_000;
  for (let i = 0; i < MAX_FAILS - 1; i++) recordFail("a@x.com", t);
  assert.equal(isLocked("a@x.com", t), false);
  recordFail("a@x.com", t);
  assert.equal(isLocked("a@x.com", t), true);
  assert.equal(isLocked("b@x.com", t), false); // per email
  assert.equal(isLocked("a@x.com", t + WINDOW_MS + 1), false);

  for (let i = 0; i < MAX_FAILS; i++) recordFail("c@x.com", t);
  clearFails("c@x.com");
  assert.equal(isLocked("c@x.com", t), false);
});
