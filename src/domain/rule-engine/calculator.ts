// Per-employee monthly payroll calculator (SPEC §8.3 Steps 1–3 + 5).
// Pure function. SpecialRule (Step 4) is Phase 2.

import { actualWorkMinutes } from '@/domain/attendance/calc';
import { classifyDay } from './day-classifier';
import { nightMinutesIn } from './night-window';
import type { CalcAlert, EmployeeCalcInput, EmployeeCalcResult } from './types';

const LEGAL_DAILY_MINUTES = 480; // 8h legal daily ceiling

export function calculatePayrollForEmployee(input: EmployeeCalcInput): EmployeeCalcResult {
  const { records, rules } = input;
  const scheduled = rules.basic.scheduledWorkMinutesPerDay;

  let totalWorkMinutes = 0;
  let regularWorkMinutes = 0;
  let overtimeLegalMinutes = 0;
  let overtimeStatutoryMinutes = 0;
  let nightWorkMinutes = 0;
  let holidayLegalMinutes = 0;
  let holidayCompanyMinutes = 0;
  let paidLeaveDays = 0;
  let absenceDays = 0;

  // ---- Step 1+2: per-day classification & accumulation ------------
  for (const r of records) {
    if (r.absenceType === 'paid_leave') {
      paidLeaveDays += 1;
      continue;
    }
    if (r.absenceType === 'absent') {
      absenceDays += 1;
      continue;
    }

    if (!r.clockInAt || !r.clockOutAt) continue; // 打刻漏れは集計対象外
    const work = actualWorkMinutes(r.clockInAt, r.clockOutAt, r.breakMinutes);
    if (work === null || work === 0) continue;

    totalWorkMinutes += work;

    const dayType = classifyDay(r.workDate, rules.holiday);

    if (dayType === 'legal_holiday') {
      holidayLegalMinutes += work;
      // 深夜割増は休日労働時も別個に発生し得るが、Phase 1 は休日に内包せず
      // 深夜は週日のみ集計（割増単価はMFクラウド側で再計算）
      continue;
    }
    if (dayType === 'company_holiday' || dayType === 'custom_holiday') {
      holidayCompanyMinutes += work;
      continue;
    }

    // weekday
    if (work <= scheduled) {
      regularWorkMinutes += work;
    } else if (work <= LEGAL_DAILY_MINUTES) {
      regularWorkMinutes += scheduled;
      overtimeLegalMinutes += work - scheduled;
    } else {
      regularWorkMinutes += scheduled;
      overtimeLegalMinutes += LEGAL_DAILY_MINUTES - scheduled;
      overtimeStatutoryMinutes += work - LEGAL_DAILY_MINUTES;
    }

    nightWorkMinutes += nightMinutesIn(r.clockInAt, r.clockOutAt, rules.overtime);
  }

  // ---- Step 3: monthly aggregations -------------------------------

  // 3a. みなし残業 (fixedOvertime) を控除
  if (rules.overtime.fixedOvertimeMinutes > 0) {
    let remaining = rules.overtime.fixedOvertimeMinutes;
    // 法定内残業から控除 → 残りを法定外残業から控除
    const fromLegal = Math.min(remaining, overtimeLegalMinutes);
    overtimeLegalMinutes -= fromLegal;
    remaining -= fromLegal;
    const fromStatutory = Math.min(remaining, overtimeStatutoryMinutes);
    overtimeStatutoryMinutes -= fromStatutory;
  }

  // 3b. 60h超を切り出す
  let over60hMinutes = 0;
  if (rules.overtime.over60hEnabled && overtimeStatutoryMinutes > 60 * 60) {
    over60hMinutes = overtimeStatutoryMinutes - 60 * 60;
  }

  // ---- Step 5: 36協定アラート -------------------------------------
  const alerts: CalcAlert[] = [];
  const monthlyOT = overtimeLegalMinutes + overtimeStatutoryMinutes;
  const limit = rules.agreement36.monthlyLimitMinutes;
  const warnAt = Math.floor(limit * rules.agreement36.warningThresholdPercent);
  if (monthlyOT >= limit) {
    alerts.push({
      type: 'agreement36_monthly',
      severity: 'danger',
      message: `月の残業時間 ${(monthlyOT / 60).toFixed(1)}h が36協定の上限 ${limit / 60}h を超過`,
      value: monthlyOT,
      threshold: limit,
    });
  } else if (monthlyOT >= warnAt) {
    alerts.push({
      type: 'agreement36_monthly',
      severity: 'warning',
      message: `月の残業時間 ${(monthlyOT / 60).toFixed(1)}h が警告閾値 ${warnAt / 60}h を超過`,
      value: monthlyOT,
      threshold: warnAt,
    });
  }

  return {
    totalWorkMinutes,
    regularWorkMinutes,
    overtimeLegalMinutes,
    overtimeStatutoryMinutes,
    nightWorkMinutes,
    holidayLegalMinutes,
    holidayCompanyMinutes,
    over60hMinutes,
    paidLeaveDays,
    absenceDays,
    alerts,
  };
}
