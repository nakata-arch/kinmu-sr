'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

const SaveSchema = z
  .object({
    recordId: z.string().uuid().nullable(),
    workplaceSlug: z.string().min(1),
    employeeId: z.string().uuid(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clockInTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    clockOutTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    breakMinutes: z.number().int().min(0).max(720),
    absenceType: z.enum(['none', 'paid_leave', 'absent', 'special']),
    note: z.string().max(500).nullable(),
  })
  .refine(
    (v) => v.absenceType !== 'none' || v.clockInTime || v.clockOutTime,
    { message: '勤務日は出勤時刻または退勤時刻のいずれかを入力してください' },
  );

export type SaveInput = z.infer<typeof SaveSchema>;
export type SaveResult = { ok: true; recordId: string } | { error: string };

function combineJST(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
}

export async function saveAttendance(raw: unknown): Promise<SaveResult> {
  const parsed = SaveSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力が不正です' };
  }
  const input = parsed.data;

  // Auth
  const admin = await requireAdmin({ workplaceSlug: input.workplaceSlug });

  const supabase = createAdminClient();

  // Resolve workplace
  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, tenant_id')
    .eq('slug', input.workplaceSlug)
    .maybeSingle();
  if (!workplace) return { error: '事業所が見つかりません' };

  // Verify employee belongs to workplace
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('id', input.employeeId)
    .eq('workplace_id', workplace.id)
    .maybeSingle();
  if (!employee) return { error: '従業員が見つかりません' };

  // Build new values
  const isAbsence = input.absenceType !== 'none';
  const newValues = {
    tenant_id: workplace.tenant_id,
    workplace_id: workplace.id,
    employee_id: input.employeeId,
    work_date: input.workDate,
    clock_in_at:
      isAbsence || !input.clockInTime ? null : combineJST(input.workDate, input.clockInTime),
    clock_out_at:
      isAbsence || !input.clockOutTime ? null : combineJST(input.workDate, input.clockOutTime),
    break_minutes: isAbsence ? 0 : input.breakMinutes,
    absence_type: isAbsence ? input.absenceType : null,
    note: input.note,
    status: 'approved' as const,
    approved_by: admin.userId,
    approved_at: new Date().toISOString(),
  };

  // Load before-state if updating
  let recordId = input.recordId;
  let beforeValue: Record<string, unknown> | null = null;

  if (recordId) {
    const { data: before } = await supabase
      .from('attendance_records')
      .select('clock_in_at, clock_out_at, break_minutes, absence_type, note, status')
      .eq('id', recordId)
      .maybeSingle();
    beforeValue = before;

    const { error: updErr } = await supabase
      .from('attendance_records')
      .update(newValues)
      .eq('id', recordId);
    if (updErr) return { error: updErr.message };
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('attendance_records')
      .insert(newValues)
      .select('id')
      .single();
    if (insErr) return { error: insErr.message };
    recordId = ins.id;
  }

  // Audit log
  const auditAfter = {
    clock_in_at: newValues.clock_in_at,
    clock_out_at: newValues.clock_out_at,
    break_minutes: newValues.break_minutes,
    absence_type: newValues.absence_type,
    note: newValues.note,
    status: newValues.status,
  };
  await supabase.from('audit_logs').insert({
    tenant_id: workplace.tenant_id,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: beforeValue ? 'update' : 'create',
    resource_type: 'attendance_record',
    resource_id: recordId,
    before_value: (beforeValue ?? null) as never,
    after_value: auditAfter as never,
    metadata: {
      source: 'admin_edit',
      work_date: input.workDate,
    } as never,
  });

  revalidatePath(`/admin/${input.workplaceSlug}/attendance`);

  return { ok: true, recordId: recordId! };
}
