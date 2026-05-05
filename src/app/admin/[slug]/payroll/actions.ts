'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { loadPayrollMonth } from '@/server/payroll-loader';

const FinalizeSchema = z.object({
  workplaceSlug: z.string().min(1),
  monthYmd: z.string().regex(/^\d{4}-\d{2}$/),
});

export type FinalizeResult =
  | { ok: true; payrollRunId: string }
  | { error: string };

function monthBounds(month: string): { start: string; end: string; firstDay: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${y}-${m.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { start, end, firstDay: start };
}

/**
 * Finalize a month's payroll.
 *  - shacho only (per SPEC §6.3 — bizpla_bpo cannot finalize, intentional)
 *  - Inserts/updates payroll_runs row (status='finalized')
 *  - Replaces payroll_results rows for that run
 *  - Locks attendance_records by setting status='finalized'
 *  - Audit log entry
 *
 * Idempotent re-run is rejected — finalized runs require an "unlock"
 * (Phase 2). Re-finalize an unfinalized 'calculated' / 'reviewing' run
 * is allowed.
 */
export async function finalizePayroll(raw: unknown): Promise<FinalizeResult> {
  const parsed = FinalizeSchema.safeParse(raw);
  if (!parsed.success) return { error: '入力が不正です' };
  const { workplaceSlug, monthYmd } = parsed.data;

  const admin = await requireAdmin({
    workplaceSlug,
    rolesAllowed: ['shacho'], // SPEC §6.3: only shacho can finalize
  });

  const result = await loadPayrollMonth({ workplaceSlug, monthYmd });
  if (!result) return { error: '事業所が見つかりません' };

  const supabase = createAdminClient();
  const { firstDay, start, end } = monthBounds(monthYmd);
  const nowIso = new Date().toISOString();

  // Existing run?
  const { data: existing } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .eq('workplace_id', result.workplace.id)
    .eq('target_month', firstDay)
    .maybeSingle();

  if (existing?.status === 'finalized') {
    return { error: 'この月は既に最終確定済みです' };
  }

  const summary = {
    employee_count: result.employees.length,
    total_overtime_minutes: result.employees.reduce(
      (s, e) => s + e.result.overtimeLegalMinutes + e.result.overtimeStatutoryMinutes,
      0,
    ),
    danger_alerts: result.employees.filter((e) =>
      e.result.alerts.some((a) => a.severity === 'danger'),
    ).length,
    warning_alerts: result.employees.filter((e) =>
      e.result.alerts.some((a) => a.severity === 'warning'),
    ).length,
  };

  let payrollRunId: string;

  if (existing) {
    const { error: updErr } = await supabase
      .from('payroll_runs')
      .update({
        status: 'finalized',
        rules_version: result.rulesVersion,
        calculated_at: nowIso,
        finalized_at: nowIso,
        finalized_by: admin.userId,
        summary: summary as never,
      })
      .eq('id', existing.id);
    if (updErr) return { error: updErr.message };
    payrollRunId = existing.id;
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('payroll_runs')
      .insert({
        tenant_id: result.workplace.tenantId,
        workplace_id: result.workplace.id,
        target_month: firstDay,
        rules_version: result.rulesVersion,
        status: 'finalized',
        calculated_at: nowIso,
        finalized_at: nowIso,
        finalized_by: admin.userId,
        summary: summary as never,
      })
      .select('id')
      .single();
    if (insErr) return { error: insErr.message };
    payrollRunId = ins.id;
  }

  // Replace per-employee results
  await supabase.from('payroll_results').delete().eq('payroll_run_id', payrollRunId);
  if (result.employees.length > 0) {
    const rows = result.employees.map((e) => ({
      payroll_run_id: payrollRunId,
      employee_id: e.id,
      total_work_minutes: e.result.totalWorkMinutes,
      regular_work_minutes: e.result.regularWorkMinutes,
      overtime_legal_minutes: e.result.overtimeLegalMinutes,
      overtime_statutory_minutes: e.result.overtimeStatutoryMinutes,
      night_work_minutes: e.result.nightWorkMinutes,
      holiday_legal_minutes: e.result.holidayLegalMinutes,
      holiday_company_minutes: e.result.holidayCompanyMinutes,
      over_60h_minutes: e.result.over60hMinutes,
      paid_leave_days: e.result.paidLeaveDays,
      absence_days: e.result.absenceDays,
      alerts: e.result.alerts as never,
    }));
    const { error: resErr } = await supabase.from('payroll_results').insert(rows);
    if (resErr) return { error: resErr.message };
  }

  // Lock attendance records for the month
  const { error: lockErr } = await supabase
    .from('attendance_records')
    .update({ status: 'finalized' })
    .eq('workplace_id', result.workplace.id)
    .gte('work_date', start)
    .lte('work_date', end)
    .neq('status', 'finalized');
  if (lockErr) return { error: lockErr.message };

  // Audit
  await supabase.from('audit_logs').insert({
    tenant_id: result.workplace.tenantId,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'finalize',
    resource_type: 'payroll_run',
    resource_id: payrollRunId,
    after_value: { status: 'finalized', target_month: firstDay, summary } as never,
    metadata: { source: 'admin_payroll_finalize', month: monthYmd } as never,
  });

  revalidatePath(`/admin/${workplaceSlug}/payroll`);
  revalidatePath(`/admin/${workplaceSlug}/attendance`);

  return { ok: true, payrollRunId };
}
