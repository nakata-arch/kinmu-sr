import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculatePayrollForEmployee } from '@/domain/rule-engine/calculator';
import { DEFAULT_RULES } from '@/domain/rule-engine/default-rules';
import type {
  AttendanceDaily,
  CalculationRules,
  EmployeeCalcResult,
} from '@/domain/rule-engine/types';

export interface PayrollLoadInput {
  workplaceSlug: string;
  monthYmd: string; // YYYY-MM
}

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  lastName: string;
  firstName: string;
  department: string | null;
  result: EmployeeCalcResult;
}

export interface PayrollLoadResult {
  workplace: { id: string; name: string; tenantId: string };
  rulesVersion: number;
  rules: CalculationRules;
  employees: EmployeeRow[];
  attendanceConfirmedRate: number; // 0..1
  totalAttendanceRecords: number;
  approvedCount: number;
}

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${m.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { start, end };
}

/**
 * Load workplace + employees + month attendance, then run the rule engine
 * for each employee. Pure read; no DB writes / no payroll_runs persistence
 * (Phase 1 keeps results computed on the fly until 最終確定 lands).
 */
export async function loadPayrollMonth(input: PayrollLoadInput): Promise<PayrollLoadResult | null> {
  const { workplaceSlug, monthYmd } = input;
  const supabase = createAdminClient();

  const { data: wp } = await supabase
    .from('workplaces')
    .select('id, name, tenant_id')
    .eq('slug', workplaceSlug)
    .eq('is_active', true)
    .maybeSingle();
  if (!wp) return null;

  // Active calculation_rules for the month-start (Phase 1: fall back to DEFAULT_RULES)
  const { start, end } = monthBounds(monthYmd);
  const { data: rulesRow } = await supabase
    .from('calculation_rules')
    .select('version, rules, effective_from')
    .eq('workplace_id', wp.id)
    .lte('effective_from', start)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const rules: CalculationRules = (rulesRow?.rules as CalculationRules | null) ?? DEFAULT_RULES;
  const rulesVersion = rulesRow?.version ?? 0;

  // Employees in workplace
  const { data: emps } = await supabase
    .from('employees')
    .select('id, employee_code, last_name, first_name, department')
    .eq('workplace_id', wp.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('employee_code');
  const employees = emps ?? [];
  const empIds = employees.map((e) => e.id);

  // Attendance for the month
  const recordsByEmp = new Map<string, AttendanceDaily[]>();
  let approved = 0;
  let total = 0;
  if (empIds.length > 0) {
    const { data: records } = await supabase
      .from('attendance_records')
      .select('employee_id, work_date, clock_in_at, clock_out_at, break_minutes, absence_type, status')
      .in('employee_id', empIds)
      .gte('work_date', start)
      .lte('work_date', end);

    for (const r of records ?? []) {
      total += 1;
      if (r.status === 'approved' || r.status === 'finalized') approved += 1;
      const arr = recordsByEmp.get(r.employee_id) ?? [];
      arr.push({
        workDate: r.work_date,
        clockInAt: r.clock_in_at ? new Date(r.clock_in_at) : null,
        clockOutAt: r.clock_out_at ? new Date(r.clock_out_at) : null,
        breakMinutes: r.break_minutes,
        absenceType: r.absence_type,
      });
      recordsByEmp.set(r.employee_id, arr);
    }
  }

  const employeeRows: EmployeeRow[] = employees.map((e) => {
    const records = recordsByEmp.get(e.id) ?? [];
    const result = calculatePayrollForEmployee({
      employeeId: e.id,
      records,
      rules,
    });
    return {
      id: e.id,
      employeeCode: e.employee_code,
      lastName: e.last_name,
      firstName: e.first_name,
      department: e.department,
      result,
    };
  });

  return {
    workplace: { id: wp.id, name: wp.name, tenantId: wp.tenant_id },
    rulesVersion,
    rules,
    employees: employeeRows,
    attendanceConfirmedRate: total === 0 ? 1 : approved / total,
    totalAttendanceRecords: total,
    approvedCount: approved,
  };
}
