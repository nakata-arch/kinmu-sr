import type { BreakInterval } from './types';

export function calculateClosedBreakMinutes(breaks: readonly BreakInterval[]): number {
  return breaks.reduce((total, b) => {
    if (b.endedAt === null) return total;
    const ms = b.endedAt.getTime() - b.startedAt.getTime();
    if (ms <= 0) return total;
    return total + Math.floor(ms / 60_000);
  }, 0);
}

export function findOpenBreak(breaks: readonly BreakInterval[]): BreakInterval | null {
  return breaks.find((b) => b.endedAt === null) ?? null;
}
