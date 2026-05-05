import type { DayOfWeek, DayType, HolidayRules } from './types';

const DOW_TABLE: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Get the day of the week for a YYYY-MM-DD string treated as a calendar
 * date (no time, no timezone shenanigans). Date.UTC produces a timezone-
 * neutral instant whose getUTCDay matches the calendar weekday.
 */
export function dayOfWeekJST(workDateYmd: string): DayOfWeek {
  const [y, m, d] = workDateYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DOW_TABLE[dow];
}

/**
 * Classify a single work date against the workplace's holiday rules.
 *
 * Precedence: customHolidays > legalHoliday > companyHolidays > weekday.
 * If a date is in customHolidays it is a 'custom_holiday' even if it would
 * also be a legal/company holiday by weekday — the custom flag wins for
 * one-off shifts.
 */
export function classifyDay(workDateYmd: string, rules: HolidayRules): DayType {
  if (rules.customHolidays.includes(workDateYmd)) return 'custom_holiday';
  const dow = dayOfWeekJST(workDateYmd);
  if (dow === rules.legalHoliday) return 'legal_holiday';
  if (rules.companyHolidays.includes(dow)) return 'company_holiday';
  return 'weekday';
}
