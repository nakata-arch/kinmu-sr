import type { CalculationRules } from './types';

/**
 * Phase 1 default ruleset, used when a workplace has no calculation_rules
 * row yet. Conservative defaults that match a typical 9-18 office:
 *   - 8h scheduled, 60min break
 *   - sat=所定休日 / sun=法定休日
 *   - 深夜 22:00–05:00
 *   - 36協定: 月45h, 年360h, 80%で警告
 *   - みなし残業なし
 */
export const DEFAULT_RULES: CalculationRules = {
  version: 0,
  basic: {
    scheduledWorkMinutesPerDay: 480, // 8h
    scheduledStartTime: '09:00',
    scheduledEndTime: '18:00',
    breakMinutes: 60,
    weeklyHolidays: ['sat', 'sun'],
  },
  overtime: {
    definition: 'beyond_legal',
    fixedOvertimeMinutes: 0,
    nightStartTime: '22:00',
    nightEndTime: '05:00',
    over60hEnabled: true,
  },
  holiday: {
    legalHoliday: 'sun',
    companyHolidays: ['sat'],
    customHolidays: [],
  },
  allowance: {
    weekdayOvertimeRate: 0.25,
    nightOvertimeRate: 0.25,
    legalHolidayRate: 0.35,
    companyHolidayRate: 0.25,
    over60hRate: 0.5,
  },
  agreement36: {
    monthlyLimitMinutes: 45 * 60, // 2700
    yearlyLimitMinutes: 360 * 60, // 21600
    warningThresholdPercent: 0.8,
  },
};
