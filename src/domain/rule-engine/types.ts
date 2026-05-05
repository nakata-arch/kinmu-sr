// Calculation-rule types for the payroll engine (SPEC §8.1).
// Phase 1 / Sprint 4 implements: BasicRules, OvertimeRules, HolidayRules,
// AllowanceRules (carried for display only — MFクラウド側で単価適用),
// Agreement36Rules. SpecialRule and EmploymentTypeRules are Phase 2.

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface BasicRules {
  /** 所定労働時間 (分/日) — typical 480 (8h) */
  scheduledWorkMinutesPerDay: number;
  /** 'HH:MM' (JST) */
  scheduledStartTime: string;
  scheduledEndTime: string;
  /** 標準休憩 (分) — display only */
  breakMinutes: number;
  /** 週間の休日（曜日）。`legalHoliday` は別途 HolidayRules で指定 */
  weeklyHolidays: DayOfWeek[];
}

export interface OvertimeRules {
  /** Phase 1 では参考扱い。実装は常に法定 (8h) を超えた分を法定外残業とする */
  definition: 'beyond_scheduled' | 'beyond_legal';
  /** みなし残業 (分/月)。0 ならなし */
  fixedOvertimeMinutes: number;
  /** 深夜時間帯の開始 'HH:MM' (例 '22:00') */
  nightStartTime: string;
  /** 深夜時間帯の終了 'HH:MM' (翌日扱い、例 '05:00') */
  nightEndTime: string;
  /** true なら 60h超残業を切り出す */
  over60hEnabled: boolean;
}

export interface HolidayRules {
  /** 法定休日の曜日 (週1日以上の労基法義務) */
  legalHoliday: DayOfWeek;
  /** 所定休日の曜日（複数） */
  companyHolidays: DayOfWeek[];
  /** 国民の祝日や年末年始など、特定日付 'YYYY-MM-DD' */
  customHolidays: string[];
}

export interface AllowanceRules {
  /** 平日法定外残業の割増率 (例 0.25 = 25%) */
  weekdayOvertimeRate: number;
  nightOvertimeRate: number;
  /** 法定休日労働の割増率 (通常 0.35) */
  legalHolidayRate: number;
  /** 所定休日労働の割増率 */
  companyHolidayRate: number;
  /** 60h超残業の割増率 (通常 0.50) */
  over60hRate: number;
}

export interface Agreement36Rules {
  monthlyLimitMinutes: number;
  yearlyLimitMinutes: number;
  /** 警告閾値 (0..1)。例 0.8 で 80% 到達で警告 */
  warningThresholdPercent: number;
}

export interface CalculationRules {
  version: number;
  basic: BasicRules;
  overtime: OvertimeRules;
  holiday: HolidayRules;
  allowance: AllowanceRules;
  agreement36: Agreement36Rules;
}

// =============================================================
// Engine I/O
// =============================================================

export interface AttendanceDaily {
  /** YYYY-MM-DD (JST) */
  workDate: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  breakMinutes: number;
  /** 'paid_leave' | 'absent' | 'special' | null */
  absenceType: string | null;
}

export interface EmployeeCalcInput {
  employeeId: string;
  records: AttendanceDaily[];
  rules: CalculationRules;
}

export interface CalcAlert {
  type: 'agreement36_monthly' | 'long_work' | 'custom';
  severity: 'info' | 'warning' | 'danger';
  message: string;
  value?: number;
  threshold?: number;
}

export interface EmployeeCalcResult {
  totalWorkMinutes: number;
  regularWorkMinutes: number;
  overtimeLegalMinutes: number;
  overtimeStatutoryMinutes: number;
  nightWorkMinutes: number;
  holidayLegalMinutes: number;
  holidayCompanyMinutes: number;
  over60hMinutes: number;
  paidLeaveDays: number;
  absenceDays: number;
  alerts: CalcAlert[];
}

export type DayType = 'weekday' | 'company_holiday' | 'legal_holiday' | 'custom_holiday';
