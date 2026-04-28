'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { TZ } from '@/lib/datetime';
import { formatInTimeZone } from 'date-fns-tz';
import { determineState, isPunchAllowed } from '@/domain/attendance/state';
import type { PunchType } from '@/domain/attendance/types';

const PUNCH_LABEL: Record<PunchType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const InputSchema = z
  .object({
    type: z.enum(['clock_in', 'clock_out', 'break_start', 'break_end']),
    token: z.string().min(1).optional(),
    workplace_slug: z.string().min(1).optional(),
    employee_id: z.string().uuid().optional(),
  })
  .refine(
    (v) => Boolean(v.token) !== Boolean(v.workplace_slug && v.employee_id),
    { message: 'identifier_invalid' },
  );

export type PunchResult = { ok: true } | { error: string };

export async function punchAction(formData: FormData): Promise<PunchResult> {
  const parsed = InputSchema.safeParse({
    type: formData.get('type'),
    token: formData.get('token') ?? undefined,
    workplace_slug: formData.get('workplace_slug') ?? undefined,
    employee_id: formData.get('employee_id') ?? undefined,
  });
  if (!parsed.success) return { error: '入力が不正です' };

  const { type, token, workplace_slug, employee_id } = parsed.data;
  const supabase = createAdminClient();

  // 1. Resolve employee
  let employee:
    | { id: string; tenant_id: string; workplace_id: string }
    | null = null;

  if (token) {
    const { data } = await supabase
      .from('employees')
      .select('id, tenant_id, workplace_id')
      .eq('punch_token', token)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    employee = data;
  } else if (workplace_slug && employee_id) {
    const { data: wp } = await supabase
      .from('workplaces')
      .select('id')
      .eq('slug', workplace_slug)
      .maybeSingle();
    if (!wp) return { error: '事業所が見つかりません' };
    const { data } = await supabase
      .from('employees')
      .select('id, tenant_id, workplace_id')
      .eq('id', employee_id)
      .eq('workplace_id', wp.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    employee = data;
  }

  if (!employee) return { error: '従業員が特定できません' };

  // 2. Today (JST)
  const nowIso = new Date().toISOString();
  const workDate = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

  // 3. Load today's record + break state
  const { data: existing } = await supabase
    .from('attendance_records')
    .select('id, clock_in_at, clock_out_at')
    .eq('employee_id', employee.id)
    .eq('work_date', workDate)
    .maybeSingle();

  let openBreakStartedAt: Date | null = null;
  if (existing) {
    const { data: openBreak } = await supabase
      .from('break_records')
      .select('started_at')
      .eq('attendance_record_id', existing.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openBreak) openBreakStartedAt = new Date(openBreak.started_at);
  }

  const state = determineState({
    clockInAt: existing?.clock_in_at ? new Date(existing.clock_in_at) : null,
    clockOutAt: existing?.clock_out_at ? new Date(existing.clock_out_at) : null,
    openBreakStartedAt,
  });

  if (!isPunchAllowed(state, type)) {
    return { error: `現在「${PUNCH_LABEL[type]}」できません（状態: ${state}）` };
  }

  // 4. Apply punch
  let attendanceId = existing?.id ?? null;

  if (type === 'clock_in') {
    if (!existing) {
      const { data, error } = await supabase
        .from('attendance_records')
        .insert({
          tenant_id: employee.tenant_id,
          workplace_id: employee.workplace_id,
          employee_id: employee.id,
          work_date: workDate,
          clock_in_at: nowIso,
          status: 'submitted',
        })
        .select('id')
        .single();
      if (error) return { error: error.message };
      attendanceId = data.id;
    }
  } else if (type === 'clock_out') {
    const { error } = await supabase
      .from('attendance_records')
      .update({ clock_out_at: nowIso })
      .eq('id', attendanceId!);
    if (error) return { error: error.message };
  } else if (type === 'break_start') {
    const { error } = await supabase.from('break_records').insert({
      attendance_record_id: attendanceId!,
      started_at: nowIso,
    });
    if (error) return { error: error.message };
  } else if (type === 'break_end') {
    const { data: open } = await supabase
      .from('break_records')
      .select('id, started_at')
      .eq('attendance_record_id', attendanceId!)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!open) return { error: '休憩記録が見つかりません' };

    const { error: closeErr } = await supabase
      .from('break_records')
      .update({ ended_at: nowIso })
      .eq('id', open.id);
    if (closeErr) return { error: closeErr.message };

    // Recompute total break_minutes for the day
    const { data: allBreaks } = await supabase
      .from('break_records')
      .select('started_at, ended_at')
      .eq('attendance_record_id', attendanceId!);

    const total = (allBreaks ?? []).reduce((sum, b) => {
      if (!b.ended_at) return sum;
      const ms = new Date(b.ended_at).getTime() - new Date(b.started_at).getTime();
      return ms > 0 ? sum + Math.floor(ms / 60_000) : sum;
    }, 0);

    await supabase
      .from('attendance_records')
      .update({ break_minutes: total })
      .eq('id', attendanceId!);
  }

  // 5. Audit log
  const hdrs = await headers();
  const clientIp =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    null;
  const userAgent = hdrs.get('user-agent') ?? null;

  await supabase.from('audit_logs').insert({
    tenant_id: employee.tenant_id,
    actor_id: null,
    actor_role: 'employee',
    action: type,
    resource_type: 'attendance_record',
    resource_id: attendanceId,
    metadata: {
      client_ip: clientIp,
      user_agent: userAgent,
      punch_method: token ? 'token' : 'shared_pc',
    },
  });

  // 6. Revalidate the page that triggered the punch
  if (token) {
    revalidatePath(`/p/${token}`);
  } else if (workplace_slug) {
    revalidatePath(`/w/${workplace_slug}`);
    if (employee_id) revalidatePath(`/w/${workplace_slug}/${employee_id}`);
  }

  return { ok: true };
}
