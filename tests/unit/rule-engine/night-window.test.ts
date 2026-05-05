import { describe, expect, test } from 'vitest';
import { nightMinutesIn } from '@/domain/rule-engine/night-window';

const RULES = { nightStartTime: '22:00', nightEndTime: '05:00' };
const at = (s: string) => new Date(`${s}+09:00`); // JST literal

describe('nightMinutesIn', () => {
  test('shift entirely outside the night window → 0', () => {
    expect(
      nightMinutesIn(at('2026-05-01T09:00:00'), at('2026-05-01T18:00:00'), RULES),
    ).toBe(0);
  });

  test('worked until 23:00 → 1h overlap with 22:00–05:00', () => {
    expect(
      nightMinutesIn(at('2026-05-01T09:00:00'), at('2026-05-01T23:00:00'), RULES),
    ).toBe(60);
  });

  test('worked through midnight 22:30 → 02:00 → 3h30m overlap', () => {
    expect(
      nightMinutesIn(at('2026-05-01T22:30:00'), at('2026-05-02T02:00:00'), RULES),
    ).toBe(210);
  });

  test('previous-night window: clock-in 03:00 → 06:00 → 2h overlap (03:00–05:00)', () => {
    expect(
      nightMinutesIn(at('2026-05-02T03:00:00'), at('2026-05-02T06:00:00'), RULES),
    ).toBe(120);
  });

  test('overnight shift covering the entire window 22:00 → 05:00 → 7h', () => {
    expect(
      nightMinutesIn(at('2026-05-01T22:00:00'), at('2026-05-02T05:00:00'), RULES),
    ).toBe(420);
  });

  test('clock_out before clock_in → 0', () => {
    expect(
      nightMinutesIn(at('2026-05-01T18:00:00'), at('2026-05-01T09:00:00'), RULES),
    ).toBe(0);
  });

  test('boundary: ends exactly at 22:00 → 0 night minutes', () => {
    expect(
      nightMinutesIn(at('2026-05-01T09:00:00'), at('2026-05-01T22:00:00'), RULES),
    ).toBe(0);
  });
});
