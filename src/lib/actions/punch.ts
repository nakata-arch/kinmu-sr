'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSnapshot, type TodayPunchSnapshot } from '@/server/punch-state';

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

export type PunchResult =
  | { ok: true; snapshot: TodayPunchSnapshot }
  | { error: string };

const ERROR_MESSAGES: Record<string, string> = {
  employee_not_found: '従業員が特定できません',
  invalid_transition: '現在の状態では打刻できません',
};

export async function punchAction(formData: FormData): Promise<PunchResult> {
  const parsed = InputSchema.safeParse({
    type: formData.get('type'),
    token: formData.get('token') ?? undefined,
    workplace_slug: formData.get('workplace_slug') ?? undefined,
    employee_id: formData.get('employee_id') ?? undefined,
  });
  if (!parsed.success) return { error: '入力が不正です' };

  const { type, token, workplace_slug, employee_id } = parsed.data;

  const hdrs = await headers();
  const clientIp =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('apply_punch', {
    p_punch_type: type,
    p_token: token ?? undefined,
    p_workplace_slug: workplace_slug ?? undefined,
    p_employee_id: employee_id ?? undefined,
    p_punch_method: token ? 'token' : 'shared_pc',
    p_client_ip: clientIp ?? undefined,
    p_user_agent: userAgent ?? undefined,
  });

  if (error) return { error: error.message };

  const result = data as
    | { ok: true; snapshot: { clock_in_at: string | null; clock_out_at: string | null; open_break_started_at: string | null } }
    | { ok: false; error: string; state?: string };

  if (!result.ok) {
    return { error: ERROR_MESSAGES[result.error] ?? result.error };
  }

  return { ok: true, snapshot: buildSnapshot(result.snapshot) };
}
