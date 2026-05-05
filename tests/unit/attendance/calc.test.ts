import { describe, expect, test } from 'vitest';
import {
  actualWorkMinutes,
  overtimeMinutes,
  formatHHMM,
  deriveRowStatus,
  rowNeedsAttention,
} from '@/domain/attendance/calc';

const at = (s: string) => new Date(s);

describe('actualWorkMinutes', () => {
  test('null when clock-in missing', () => {
    expect(actualWorkMinutes(null, at('2026-05-01T18:00:00Z'), 0)).toBeNull();
  });
  test('null when clock-out missing', () => {
    expect(actualWorkMinutes(at('2026-05-01T09:00:00Z'), null, 0)).toBeNull();
  });
  test('subtracts break minutes', () => {
    // 9:00 → 18:00 = 540 min, minus 45 = 495
    expect(
      actualWorkMinutes(at('2026-05-01T09:00:00Z'), at('2026-05-01T18:00:00Z'), 45),
    ).toBe(495);
  });
  test('clamps to 0 when break exceeds gross', () => {
    expect(
      actualWorkMinutes(at('2026-05-01T09:00:00Z'), at('2026-05-01T09:30:00Z'), 60),
    ).toBe(0);
  });
  test('null when clock-out is before clock-in', () => {
    expect(
      actualWorkMinutes(at('2026-05-01T18:00:00Z'), at('2026-05-01T09:00:00Z'), 0),
    ).toBeNull();
  });
});

describe('overtimeMinutes', () => {
  test('0 when below 8h', () => {
    expect(overtimeMinutes(420)).toBe(0);
  });
  test('0 exactly at 8h', () => {
    expect(overtimeMinutes(480)).toBe(0);
  });
  test('above 8h', () => {
    expect(overtimeMinutes(540)).toBe(60);
  });
  test('null work minutes → 0', () => {
    expect(overtimeMinutes(null)).toBe(0);
  });
});

describe('formatHHMM', () => {
  test('null → —', () => {
    expect(formatHHMM(null)).toBe('—');
    expect(formatHHMM(undefined)).toBe('—');
  });
  test('exact zero', () => {
    expect(formatHHMM(0)).toBe('0:00');
  });
  test('minutes pad with zero', () => {
    expect(formatHHMM(65)).toBe('1:05');
  });
  test('large hours not capped', () => {
    expect(formatHHMM(495)).toBe('8:15');
    expect(formatHHMM(1500)).toBe('25:00');
  });
});

describe('deriveRowStatus', () => {
  test('paid leave', () => {
    expect(
      deriveRowStatus({ clockInAt: null, clockOutAt: null, absenceType: 'paid_leave' }, null),
    ).toBe('absence_paid');
  });
  test('completed within long-hours threshold', () => {
    expect(
      deriveRowStatus(
        { clockInAt: at('2026-05-01T09:00:00Z'), clockOutAt: at('2026-05-01T18:00:00Z'), absenceType: null },
        495,
      ),
    ).toBe('completed');
  });
  test('long hours alert', () => {
    expect(
      deriveRowStatus(
        { clockInAt: at('2026-05-01T09:00:00Z'), clockOutAt: at('2026-05-01T22:00:00Z'), absenceType: null },
        13 * 60,
      ),
    ).toBe('alert_long');
  });
  test('in progress (no clock-out)', () => {
    expect(
      deriveRowStatus(
        { clockInAt: at('2026-05-01T09:00:00Z'), clockOutAt: null, absenceType: null },
        null,
      ),
    ).toBe('in_progress');
  });
  test('clock-out without clock-in is alert', () => {
    expect(
      deriveRowStatus(
        { clockInAt: null, clockOutAt: at('2026-05-01T18:00:00Z'), absenceType: null },
        null,
      ),
    ).toBe('alert_missing');
  });
});

describe('rowNeedsAttention', () => {
  test('alerts need attention', () => {
    expect(rowNeedsAttention('alert_missing')).toBe(true);
    expect(rowNeedsAttention('alert_long')).toBe(true);
  });
  test('non-alerts do not', () => {
    expect(rowNeedsAttention('completed')).toBe(false);
    expect(rowNeedsAttention('in_progress')).toBe(false);
    expect(rowNeedsAttention('absence_paid')).toBe(false);
  });
});
