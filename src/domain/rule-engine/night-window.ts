/**
 * Night-work minute calculation. The night window is defined per ruleset
 * (typically 22:00–05:00 JST) and may cross midnight. We compute the
 * overlap of [clockIn, clockOut] with one or more night windows.
 *
 * Phase 1 implementation: assumes shift length ≤ 24h and considers two
 * candidate windows (the one starting on clockIn's JST date, and the one
 * starting the previous JST date). Sum of overlaps with both windows.
 */

const MIN_PER_MS = 1 / 60_000;

function jstDateString(d: Date): string {
  // Use the +09:00 offset of the underlying UTC instant to pick the JST date.
  // toLocaleDateString with timeZone option also works, but is slower.
  const jstMs = d.getTime() + 9 * 3_600_000;
  return new Date(jstMs).toISOString().slice(0, 10);
}

function buildNightWindow(
  baseDateYmd: string,
  startHHMM: string,
  endHHMM: string,
): { start: Date; end: Date } {
  // start = baseDate + startHHMM (JST)
  const start = new Date(`${baseDateYmd}T${startHHMM}:00+09:00`);
  // end = (start crosses midnight if endHHMM <= startHHMM as numeric minutes)
  // For Phase 1 we always treat the end as the *next* JST day, matching
  // the typical 22:00–05:00 contract window.
  const endStartsNextDay = toMinutes(endHHMM) <= toMinutes(startHHMM);
  let end = new Date(`${baseDateYmd}T${endHHMM}:00+09:00`);
  if (endStartsNextDay) {
    end = new Date(end.getTime() + 86_400_000);
  }
  return { start, end };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function overlapMinutes(a: Date, b: Date, c: Date, d: Date): number {
  const start = Math.max(a.getTime(), c.getTime());
  const end = Math.min(b.getTime(), d.getTime());
  if (end <= start) return 0;
  return Math.floor((end - start) * MIN_PER_MS);
}

export function nightMinutesIn(
  clockIn: Date,
  clockOut: Date,
  rules: { nightStartTime: string; nightEndTime: string },
): number {
  if (clockOut.getTime() <= clockIn.getTime()) return 0;

  const baseDay = jstDateString(clockIn);

  // Previous-day window (covers e.g. clockIn at 03:00 JST — was within
  // last night's 22:00–05:00 window)
  const prevDay = new Date(new Date(`${baseDay}T00:00:00+09:00`).getTime() - 86_400_000);
  const prevDayYmd = jstDateString(prevDay);

  const w1 = buildNightWindow(prevDayYmd, rules.nightStartTime, rules.nightEndTime);
  const w2 = buildNightWindow(baseDay, rules.nightStartTime, rules.nightEndTime);

  return overlapMinutes(clockIn, clockOut, w1.start, w1.end) +
         overlapMinutes(clockIn, clockOut, w2.start, w2.end);
}
