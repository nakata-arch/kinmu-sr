import { describe, expect, test } from 'vitest';
import { calculateClosedBreakMinutes, findOpenBreak } from '@/domain/attendance/breaks';
import type { BreakInterval } from '@/domain/attendance/types';

const at = (s: string) => new Date(s);

describe('calculateClosedBreakMinutes', () => {
  test('empty array → 0', () => {
    expect(calculateClosedBreakMinutes([])).toBe(0);
  });

  test('single closed 45-minute break', () => {
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:45:00Z') },
    ];
    expect(calculateClosedBreakMinutes(breaks)).toBe(45);
  });

  test('multiple closed breaks summed', () => {
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:30:00Z') }, // 30
      { startedAt: at('2026-04-28T15:00:00Z'), endedAt: at('2026-04-28T15:15:00Z') }, // 15
    ];
    expect(calculateClosedBreakMinutes(breaks)).toBe(45);
  });

  test('open break is excluded from sum', () => {
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:30:00Z') }, // 30
      { startedAt: at('2026-04-28T15:00:00Z'), endedAt: null }, // ignored
    ];
    expect(calculateClosedBreakMinutes(breaks)).toBe(30);
  });

  test('zero or negative duration is treated as 0 minutes', () => {
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:00:00Z') },
      { startedAt: at('2026-04-28T13:00:00Z'), endedAt: at('2026-04-28T12:50:00Z') },
    ];
    expect(calculateClosedBreakMinutes(breaks)).toBe(0);
  });

  test('partial minute floored', () => {
    const breaks: BreakInterval[] = [
      // 45 minutes 59 seconds → 45
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:45:59Z') },
    ];
    expect(calculateClosedBreakMinutes(breaks)).toBe(45);
  });
});

describe('findOpenBreak', () => {
  test('returns null when none open', () => {
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:30:00Z') },
    ];
    expect(findOpenBreak(breaks)).toBeNull();
  });

  test('returns the open break when one exists', () => {
    const open = { startedAt: at('2026-04-28T15:00:00Z'), endedAt: null };
    const breaks: BreakInterval[] = [
      { startedAt: at('2026-04-28T12:00:00Z'), endedAt: at('2026-04-28T12:30:00Z') },
      open,
    ];
    expect(findOpenBreak(breaks)).toBe(open);
  });

  test('returns null on empty input', () => {
    expect(findOpenBreak([])).toBeNull();
  });
});
