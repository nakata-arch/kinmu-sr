import { describe, expect, test } from 'vitest';
import { classifyDay, dayOfWeekJST } from '@/domain/rule-engine/day-classifier';
import type { HolidayRules } from '@/domain/rule-engine/types';

const RULES: HolidayRules = {
  legalHoliday: 'sun',
  companyHolidays: ['sat'],
  customHolidays: ['2026-05-04', '2026-12-31'],
};

describe('dayOfWeekJST', () => {
  // 2026-05-01 = Friday, 2026-05-02 = Saturday, 2026-05-03 = Sunday
  test('Friday', () => expect(dayOfWeekJST('2026-05-01')).toBe('fri'));
  test('Saturday', () => expect(dayOfWeekJST('2026-05-02')).toBe('sat'));
  test('Sunday', () => expect(dayOfWeekJST('2026-05-03')).toBe('sun'));
  test('Monday', () => expect(dayOfWeekJST('2026-05-04')).toBe('mon'));
});

describe('classifyDay', () => {
  test('weekday', () => {
    expect(classifyDay('2026-05-01', RULES)).toBe('weekday');
  });
  test('saturday is company_holiday', () => {
    expect(classifyDay('2026-05-02', RULES)).toBe('company_holiday');
  });
  test('sunday is legal_holiday', () => {
    expect(classifyDay('2026-05-03', RULES)).toBe('legal_holiday');
  });
  test('custom holiday wins over weekday', () => {
    // 2026-12-31 is Thursday → would be weekday, but in customHolidays
    expect(classifyDay('2026-12-31', RULES)).toBe('custom_holiday');
  });
  test('custom holiday wins over company holiday', () => {
    // 2026-05-04 is Monday (not in companyHolidays) but in customHolidays
    expect(classifyDay('2026-05-04', RULES)).toBe('custom_holiday');
  });
});
