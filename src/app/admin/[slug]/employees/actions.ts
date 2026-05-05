'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

const EMPLOYMENT_TYPES = ['regular', 'contract', 'part_time', 'arubaito', 'outsourcing'] as const;

const SaveEmployeeSchema = z.object({
  workplaceSlug: z.string().min(1),
  employeeId: z.string().uuid().nullable(), // null when creating
  employeeCode: z.string().min(1).max(20),
  lastName: z.string().min(1).max(40),
  firstName: z.string().min(1).max(40),
  lastNameKana: z.string().max(60).nullable(),
  firstNameKana: z.string().max(60).nullable(),
  department: z.string().max(60).nullable(),
  position: z.string().max(60).nullable(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SaveEmployeeInput = z.infer<typeof SaveEmployeeSchema>;
export type SaveResult = { ok: true; employeeId: string } | { error: string };

export async function saveEmployee(raw: unknown): Promise<SaveResult> {
  const parsed = SaveEmployeeSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力が不正です' };
  const input = parsed.data;

  const admin = await requireAdmin({ workplaceSlug: input.workplaceSlug });
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, tenant_id')
    .eq('slug', input.workplaceSlug)
    .maybeSingle();
  if (!workplace) return { error: '事業所が見つかりません' };

  const fields = {
    tenant_id: workplace.tenant_id,
    workplace_id: workplace.id,
    employee_code: input.employeeCode,
    last_name: input.lastName,
    first_name: input.firstName,
    last_name_kana: input.lastNameKana,
    first_name_kana: input.firstNameKana,
    department: input.department,
    position: input.position,
    employment_type: input.employmentType,
    hired_at: input.hiredAt,
  };

  let employeeId = input.employeeId;
  let beforeValue: Record<string, unknown> | null = null;

  if (employeeId) {
    const { data: before } = await supabase
      .from('employees')
      .select(
        'employee_code, last_name, first_name, last_name_kana, first_name_kana, department, position, employment_type, hired_at',
      )
      .eq('id', employeeId)
      .maybeSingle();
    beforeValue = before;

    const { error } = await supabase.from('employees').update(fields).eq('id', employeeId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from('employees')
      .insert({
        ...fields,
        is_active: true,
        punch_token: randomBytes(24).toString('base64url'),
      })
      .select('id')
      .single();
    if (error) return { error: error.message };
    employeeId = data.id;
  }

  await supabase.from('audit_logs').insert({
    tenant_id: workplace.tenant_id,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: beforeValue ? 'update' : 'create',
    resource_type: 'employee',
    resource_id: employeeId,
    before_value: (beforeValue ?? null) as never,
    after_value: fields as never,
    metadata: { source: 'admin_employee_form' } as never,
  });

  revalidatePath(`/admin/${input.workplaceSlug}/employees`);
  if (employeeId) revalidatePath(`/admin/${input.workplaceSlug}/employees/${employeeId}`);

  return { ok: true, employeeId: employeeId! };
}

const TokenSchema = z.object({
  workplaceSlug: z.string().min(1),
  employeeId: z.string().uuid(),
});

export async function regeneratePunchToken(raw: unknown): Promise<SaveResult> {
  const parsed = TokenSchema.safeParse(raw);
  if (!parsed.success) return { error: '入力が不正です' };
  const { workplaceSlug, employeeId } = parsed.data;

  const admin = await requireAdmin({ workplaceSlug });
  const supabase = createAdminClient();

  const { data: emp } = await supabase
    .from('employees')
    .select('id, tenant_id, workplace_id, punch_token, workplaces(slug)')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { error: '従業員が見つかりません' };
  if (emp.workplaces?.slug !== workplaceSlug) return { error: '事業所が一致しません' };

  const newToken = randomBytes(24).toString('base64url');
  const oldToken = emp.punch_token;

  const { error } = await supabase
    .from('employees')
    .update({ punch_token: newToken })
    .eq('id', employeeId);
  if (error) return { error: error.message };

  await supabase.from('audit_logs').insert({
    tenant_id: emp.tenant_id,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'token_rotate',
    resource_type: 'employee',
    resource_id: employeeId,
    before_value: { punch_token: '<previous>' } as never,
    after_value: { punch_token: '<rotated>' } as never,
    metadata: {
      source: 'admin_token_regen',
      old_token_prefix: oldToken?.slice(0, 6) ?? null,
      new_token_prefix: newToken.slice(0, 6),
    } as never,
  });

  revalidatePath(`/admin/${workplaceSlug}/employees/${employeeId}`);
  return { ok: true, employeeId };
}

const TerminateSchema = z.object({
  workplaceSlug: z.string().min(1),
  employeeId: z.string().uuid(),
  terminatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function terminateEmployee(raw: unknown): Promise<SaveResult> {
  const parsed = TerminateSchema.safeParse(raw);
  if (!parsed.success) return { error: '入力が不正です' };
  const { workplaceSlug, employeeId, terminatedAt } = parsed.data;

  const admin = await requireAdmin({ workplaceSlug });
  const supabase = createAdminClient();

  const { data: emp } = await supabase
    .from('employees')
    .select('id, tenant_id, workplaces(slug)')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { error: '従業員が見つかりません' };
  if (emp.workplaces?.slug !== workplaceSlug) return { error: '事業所が一致しません' };

  const { error } = await supabase
    .from('employees')
    .update({ terminated_at: terminatedAt, is_active: false })
    .eq('id', employeeId);
  if (error) return { error: error.message };

  await supabase.from('audit_logs').insert({
    tenant_id: emp.tenant_id,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'terminate',
    resource_type: 'employee',
    resource_id: employeeId,
    before_value: { is_active: true, terminated_at: null } as never,
    after_value: { is_active: false, terminated_at: terminatedAt } as never,
    metadata: { source: 'admin_termination' } as never,
  });

  revalidatePath(`/admin/${workplaceSlug}/employees`);
  revalidatePath(`/admin/${workplaceSlug}/employees/${employeeId}`);
  return { ok: true, employeeId };
}
