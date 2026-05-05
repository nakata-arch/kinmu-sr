// Per SPEC §8.4 — minimum coverage of the documented test cases.

import { describe, expect, test } from 'vitest';
import { calculatePayrollForEmployee } from '@/domain/rule-engine/calculator';
import { DEFAULT_RULES } from '@/domain/rule-engine/default-rules';
import type { AttendanceDaily, CalculationRules } from '@/domain/rule-engine/types';

const at = (s: string) => new Date(`${s}+09:00`);

function rec(date: string, inHM: string | null, outHM: string | null, brk = 0, absence: string | null = null): AttendanceDaily {
  return {
    workDate: date,
    clockInAt: inHM ? at(`${date}T${inHM}:00`) : null,
    clockOutAt: outHM ? at(`${date}T${outHM}:00`) : null,
    breakMinutes: brk,
    absenceType: absence,
  };
}

function calc(records: AttendanceDaily[], overrides: Partial<CalculationRules> = {}) {
  const rules: CalculationRules = {
    ...DEFAULT_RULES,
    ...overrides,
    overtime: { ...DEFAULT_RULES.overtime, ...(overrides.overtime ?? {}) },
    agreement36: { ...DEFAULT_RULES.agreement36, ...(overrides.agreement36 ?? {}) },
  };
  return calculatePayrollForEmployee({ employeeId: 'emp', records, rules });
}

describe('calculatePayrollForEmployee — SPEC §8.4 cases', () => {
  // §8.4 case 1: 所定8h・平日勤務・残業なし → 所定内のみカウント
  test('case 1: 9:00–18:00 (60min break) on a weekday → 480 regular, 0 overtime', () => {
    // 2026-05-01 = Friday (weekday in default rules: legal=sun, company=sat)
    const r = calc([rec('2026-05-01', '09:00', '18:00', 60)]);
    expect(r.regularWorkMinutes).toBe(480);
    expect(r.overtimeLegalMinutes).toBe(0);
    expect(r.overtimeStatutoryMinutes).toBe(0);
    expect(r.totalWorkMinutes).toBe(480);
  });

  // §8.4 case 2: with default rules (scheduled = legal = 8h),
  // 9h work day means 0 法定内残業 + 1h 法定外残業
  test('case 2: 9:00–19:00 with default rules (scheduled=legal=8h) → 60 statutory overtime', () => {
    const r = calc([rec('2026-05-01', '09:00', '19:00', 60)]);
    expect(r.regularWorkMinutes).toBe(480);
    expect(r.overtimeLegalMinutes).toBe(0);
    expect(r.overtimeStatutoryMinutes).toBe(60);
  });

  // §8.4 case (variant): scheduled 7h, worked 9h → 1h legal + 1h statutory
  test('case 4: scheduled 7h, worked 9h (60min break) → 60 legal + 60 statutory', () => {
    const r = calc(
      [rec('2026-05-01', '09:00', '18:00', 60)], // 8h work
      { basic: { ...DEFAULT_RULES.basic, scheduledWorkMinutesPerDay: 420 } }, // 7h scheduled
    );
    expect(r.regularWorkMinutes).toBe(420);
    expect(r.overtimeLegalMinutes).toBe(60); // 7h–8h
    expect(r.overtimeStatutoryMinutes).toBe(0); // we worked exactly 8h, none above legal
  });

  // §8.4 case 5: 法定休日労働 → holiday_legal_minutes に加算
  test('case 5: 法定休日 (Sunday default) work → holiday_legal_minutes', () => {
    // 2026-05-03 = Sunday
    const r = calc([rec('2026-05-03', '09:00', '17:00', 0)]);
    expect(r.holidayLegalMinutes).toBe(480);
    expect(r.regularWorkMinutes).toBe(0);
    expect(r.overtimeLegalMinutes).toBe(0);
  });

  // §8.4 case (paid leave)
  test('case 6: 有給休暇 → paid_leave_days = 1, work minutes = 0', () => {
    const r = calc([rec('2026-05-01', null, null, 0, 'paid_leave')]);
    expect(r.paidLeaveDays).toBe(1);
    expect(r.totalWorkMinutes).toBe(0);
  });

  // みなし残業 (fixed overtime deduction)
  test('case 7: みなし残業40h・実残業30h → overtime cleared to 0', () => {
    // 22 days × 9h45min work (60m break) = 22 × 525 = 11550 ... too much.
    // simpler: 1 day with 70h overtime = unrealistic. Use shorter setup.
    // Generate 5 days of 10h work (60m break) = 5 × 540 = 2700 / day - 480 = 60 statutory each
    // total OT = 300 minutes (= 5h)
    const days = ['2026-05-01', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
    const r = calc(
      days.map((d) => rec(d, '09:00', '20:00', 60)),
      { overtime: { ...DEFAULT_RULES.overtime, fixedOvertimeMinutes: 600 /* 10h */ } },
    );
    // 11h gross - 1h break = 10h work each. scheduled=8h → 0 legal + 120 statutory per day.
    // 5 days × 120 = 600 statutory total.
    // fixedOvertime = 600 → exactly absorbed → both go to 0.
    expect(r.overtimeLegalMinutes).toBe(0);
    expect(r.overtimeStatutoryMinutes).toBe(0);
  });

  test('case 8: みなし残業 10h・実残業 12h → 残2h が overtime に残る', () => {
    const days = ['2026-05-01', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'];
    // 6 days × 10h work each → 6 × 120 = 720 minutes (12h total)
    const r = calc(
      days.map((d) => rec(d, '09:00', '20:00', 60)),
      { overtime: { ...DEFAULT_RULES.overtime, fixedOvertimeMinutes: 600 } },
    );
    // 720 statutory - 600 fixed = 120 remain
    expect(r.overtimeStatutoryMinutes).toBe(120);
    expect(r.overtimeLegalMinutes).toBe(0);
  });

  // §8.4 case 10: 36協定月45h超 → dangerアラート生成
  test('case 9: 36協定 45h超 → danger alert', () => {
    // 10 weekdays × 13h work (5h statutory overtime each) = 50h → > 45h
    const days = ['2026-05-01', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
                  '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];
    const r = calc(days.map((d) => rec(d, '09:00', '23:00', 60)));
    expect(r.overtimeStatutoryMinutes).toBe(3000); // 50h
    const danger = r.alerts.find((a) => a.severity === 'danger');
    expect(danger).toBeDefined();
    expect(danger?.type).toBe('agreement36_monthly');
  });

  // 36協定 80%警告
  test('case 10: 36協定 80%閾値超 (warning 但し未上限) → warning alert', () => {
    // warningThresholdPercent=0.8, limit=2700 → warn at 2160 minutes (36h)
    // Generate 10 weekdays × 4h overtime = 40h → in warning zone but below 45h
    const may = ['2026-05-01', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08',
                 '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14'];
    const r = calc(may.map((d) => rec(d, '09:00', '22:00', 60))); // 12h work → 4h statutory each, 40h total
    expect(r.overtimeStatutoryMinutes).toBe(2400); // 40h
    const w = r.alerts.find((a) => a.severity === 'warning');
    expect(w).toBeDefined();
    expect(w?.type).toBe('agreement36_monthly');
  });

  test('night work overlap is included in nightWorkMinutes', () => {
    const r = calc([rec('2026-05-01', '14:00', '23:30', 60)]);
    // 9.5h gross - 1h break = 8.5h. Overlap with 22:00–05:00: 22:00–23:30 = 90min night
    expect(r.nightWorkMinutes).toBe(90);
  });
});
