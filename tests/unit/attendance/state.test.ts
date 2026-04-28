import { describe, expect, test } from 'vitest';
import {
  allowedPunches,
  determineState,
  isPunchAllowed,
} from '@/domain/attendance/state';
import type { AttendanceSnapshot } from '@/domain/attendance/types';

const at = (s: string) => new Date(s);

describe('determineState', () => {
  const snapshot = (over: Partial<AttendanceSnapshot> = {}): AttendanceSnapshot => ({
    clockInAt: null,
    clockOutAt: null,
    openBreakStartedAt: null,
    ...over,
  });

  test('not_started before clock-in', () => {
    expect(determineState(snapshot())).toBe('not_started');
  });

  test('working after clock-in, no break', () => {
    expect(determineState(snapshot({ clockInAt: at('2026-04-28T09:00:00Z') }))).toBe(
      'working',
    );
  });

  test('on_break when an open break exists', () => {
    expect(
      determineState(
        snapshot({
          clockInAt: at('2026-04-28T09:00:00Z'),
          openBreakStartedAt: at('2026-04-28T12:00:00Z'),
        }),
      ),
    ).toBe('on_break');
  });

  test('done after clock-out, even if a stale open break exists', () => {
    expect(
      determineState(
        snapshot({
          clockInAt: at('2026-04-28T09:00:00Z'),
          clockOutAt: at('2026-04-28T18:00:00Z'),
          openBreakStartedAt: at('2026-04-28T12:00:00Z'),
        }),
      ),
    ).toBe('done');
  });
});

describe('allowedPunches / isPunchAllowed', () => {
  test('not_started allows only clock_in', () => {
    expect(allowedPunches('not_started')).toEqual(['clock_in']);
    expect(isPunchAllowed('not_started', 'clock_in')).toBe(true);
    expect(isPunchAllowed('not_started', 'clock_out')).toBe(false);
    expect(isPunchAllowed('not_started', 'break_start')).toBe(false);
  });

  test('working allows clock_out and break_start', () => {
    expect(new Set(allowedPunches('working'))).toEqual(
      new Set(['clock_out', 'break_start']),
    );
    expect(isPunchAllowed('working', 'clock_in')).toBe(false);
    expect(isPunchAllowed('working', 'break_end')).toBe(false);
  });

  test('on_break allows only break_end', () => {
    expect(allowedPunches('on_break')).toEqual(['break_end']);
    expect(isPunchAllowed('on_break', 'clock_out')).toBe(false);
    expect(isPunchAllowed('on_break', 'break_start')).toBe(false);
  });

  test('done allows nothing', () => {
    expect(allowedPunches('done')).toEqual([]);
    expect(isPunchAllowed('done', 'clock_in')).toBe(false);
    expect(isPunchAllowed('done', 'clock_out')).toBe(false);
  });
});
