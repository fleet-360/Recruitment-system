// S-16 reports: the math behind the funnel and time-in-stage, kept pure so it can be tested.
// Placement history is read from Activity status_change rows, which store the status label (not its id).
// ponytail: renaming a placement status in settings breaks the match with older history rows; store the id on Activity if that becomes a problem.

const DAY = 86_400_000;

export type StatusChange = { toValue: string | null; createdAt: Date };

// Funnel: how many placements reached each step. A placement reached every step up to the furthest one
// it was ever at — so a rejected placement still counts for the steps it passed before the rejection.
export function funnel(histories: StatusChange[][], steps: string[]): number[] {
  const counts = steps.map(() => 0);
  for (const h of histories) {
    const furthest = Math.max(-1, ...h.map((c) => steps.indexOf(c.toValue ?? "")));
    for (let i = 0; i <= furthest; i++) counts[i]++;
  }
  return counts;
}

// Average days spent in each step, from stays that ended (the next status change). The current step doesn't count yet.
export function daysInStage(histories: StatusChange[][], steps: string[]): { avg: number | null; n: number }[] {
  const total = steps.map(() => ({ days: 0, n: 0 }));
  for (const h of histories) {
    const sorted = [...h].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      const step = steps.indexOf(sorted[i].toValue ?? "");
      if (step < 0) continue;
      total[step].days += (sorted[i + 1].createdAt.getTime() - sorted[i].createdAt.getTime()) / DAY;
      total[step].n++;
    }
  }
  return total.map((t) => ({ avg: t.n ? Math.round((t.days / t.n) * 10) / 10 : null, n: t.n }));
}
