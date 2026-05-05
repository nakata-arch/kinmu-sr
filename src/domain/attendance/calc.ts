// Pure functions used by the admin attendance list to derive display
// values from raw attendance_record + break_minutes data.
//
// Phase 1 simple semantics: 残業 = max(0, 実働 - 8h). Weekday/holiday
// classification and 36協定 splits are Phase 4 (rule engine).

import type { AttendanceState } from './types';

export const SCHEDULED_MINUTES_PER_DAY = 480; // 8h, Phase 1 default

/**
 * Calculate actual work minutes from clock_in / clock_out / break_minutes.
 * Returns null if either clock is missing or values are inconsistent.
 */
export function actualWorkMinutes(
  clockInAt: Date | null,
  clockOutAt: Date | null,
  breakMinutes: number,
): number | null {
  if (!clockInAt || !clockOutAt) return null;
  const grossMs = clockOutAt.getTime() - clockInAt.getTime();
  if (grossMs <= 0) return null;
  const grossMin = Math.floor(grossMs / 60_000);
  const net = grossMin - Math.max(0, breakMinutes);
  return Math.max(0, net);
}

/**
 * Phase 1 overtime: anything above 8h scheduled work in a single day.
 * Returns 0 if work minutes are <= scheduled.
 */
export function overtimeMinutes(
  workMinutes: number | null,
  scheduledMinutes = SCHEDULED_MINUTES_PER_DAY,
): number {
  if (workMinutes === null || workMinutes <= scheduledMinutes) return 0;
  return workMinutes - scheduledMinutes;
}

/** Format minutes as `H:MM` (e.g. 510 → "8:30"). Returns "—" for null. */
export function formatHHMM(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes === 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Per-row status used to colour and badge a single attendance row in the
 * admin list. Combines presence, completion, and basic alert heuristics.
 */
export type RowStatus =
  | 'absence_paid'      // 有給
  | 'absence'           // 欠勤
  | 'absence_other'     // その他の不在 (special など)
  | 'in_progress'       // 出勤済み・退勤待ち
  | 'completed'         // 完了
  | 'alert_missing'    // 打刻漏れ (出勤 xor 退勤 のいずれか)
  | 'alert_long';       // 長時間勤務 (実働 > 12h)

const LONG_HOURS_THRESHOLD = 12 * 60;

export interface RowStatusInput {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  absenceType: string | null;
}

export function deriveRowStatus(
  input: RowStatusInput,
  workMinutes: number | null,
): RowStatus {
  if (input.absenceType) {
    if (input.absenceType === 'paid_leave') return 'absence_paid';
    if (input.absenceType === 'absent') return 'absence';
    return 'absence_other';
  }
  const hasIn = !!input.clockInAt;
  const hasOut = !!input.clockOutAt;
  if (hasIn && hasOut) {
    if (workMinutes !== null && workMinutes > LONG_HOURS_THRESHOLD) {
      return 'alert_long';
    }
    return 'completed';
  }
  if (hasIn && !hasOut) return 'in_progress';
  if (!hasIn && hasOut) return 'alert_missing';
  // No punches at all → treat as missing if it's an expected day
  return 'alert_missing';
}

/**
 * Is this row actionable (i.e. needs admin attention)?
 * Used to compute the "要確認 N件" indicator at the top of the list.
 */
export function rowNeedsAttention(status: RowStatus): boolean {
  return status === 'alert_missing' || status === 'alert_long';
}

/** Map RowStatus to AttendanceState (for re-using existing badges). */
export function rowStatusToState(status: RowStatus): AttendanceState {
  switch (status) {
    case 'in_progress': return 'working';
    case 'completed':   return 'done';
    case 'alert_missing':
    case 'alert_long':
    case 'absence':
    case 'absence_paid':
    case 'absence_other':
    default:            return 'not_started';
  }
}
