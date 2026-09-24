import { test } from "node:test";
import assert from "node:assert/strict";
import { daysInStage, funnel } from "./reports";

const steps = ["קו״ח", "ראיון", "ניסיון", "התקבל"];
const at = (day: number) => new Date(Date.UTC(2026, 8, day));

test("funnel counts every step up to the furthest one reached, rejected included", () => {
  const histories = [
    [{ toValue: "קו״ח", createdAt: at(1) }, { toValue: "ראיון", createdAt: at(3) }, { toValue: "נדחה", createdAt: at(5) }],
    [{ toValue: "קו״ח", createdAt: at(1) }, { toValue: "ראיון", createdAt: at(2) }, { toValue: "ניסיון", createdAt: at(4) }, { toValue: "התקבל", createdAt: at(9) }],
    [{ toValue: "ראיון", createdAt: at(1) }], // skipped the first step — still counts for it
    [{ toValue: "נדחה", createdAt: at(1) }], // rejected right away — reached nothing
  ];
  assert.deepEqual(funnel(histories, steps), [3, 3, 1, 1]);
});

test("time in stage averages only stays that ended, in order of time", () => {
  const histories = [
    [{ toValue: "ראיון", createdAt: at(3) }, { toValue: "קו״ח", createdAt: at(1) }, { toValue: "ניסיון", createdAt: at(8) }], // unsorted on purpose
    [{ toValue: "קו״ח", createdAt: at(1) }, { toValue: "נדחה", createdAt: at(5) }],
  ];
  assert.deepEqual(daysInStage(histories, steps), [
    { avg: 3, n: 2 }, // 2 and 4 days
    { avg: 5, n: 1 },
    { avg: null, n: 0 }, // still there
    { avg: null, n: 0 },
  ]);
});
