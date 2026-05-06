'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

const ROLE_OPTIONS = ['shacho', 'workplace_admin', 'bizpla_bpo'] as const;

const CreateSchema = z
  .object({
    email: z.string().email().max(120),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(60),
    role: z.enum(ROLE_OPTIONS),
    workplaceId: z.string().uuid().nullable(),
  })
  .refine(
    (v) => v.role !== 'workplace_admin' || !!v.workplaceId,
    { message: '事業所管理者には事業所を選択してください', path: ['workplaceId'] },
  );

const UpdateSchema = z
  .object({
    userId: z.string().uuid(),
    displayName: z.string().min(1).max(60),
    role: z.enum(ROLE_OPTIONS),
    workplaceId: z.string().uuid().nullable(),
    isActive: z.boolean(),
    newPassword: z.string().min(8).max(128).nullable(),
  })
  .refine(
    (v) => v.role !== 'workplace_admin' || !!v.workplaceId,
    { message: '事業所管理者には事業所を選択してください', path: ['workplaceId'] },
  );

export type CreateUserInput = z.infer<typeof CreateSchema>;
export type UpdateUserInput = z.infer<typeof UpdateSchema>;
export type UsersResult = { ok: true; userId: string } | { error: string };

async function ensureMaster() {
  return requireAdmin({ rolesAllowed: ['shacho', 'bizpla_bpo'] });
}

export async function createManagementUser(raw: unknown): Promise<UsersResult> {
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力が不正です' };
  const input = parsed.data;

  const admin = await ensureMaster();
  const supabase = createAdminClient();

  // Already in public.users with this email?
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();
  if (existing) return { error: 'このメールアドレスのユーザーは既に存在します' };

  // Verify workplace belongs to same tenant when applicable
  if (input.workplaceId) {
    const { data: wp } = await supabase
      .from('workplaces')
      .select('tenant_id')
      .eq('id', input.workplaceId)
      .maybeSingle();
    if (!wp || wp.tenant_id !== admin.tenantId) {
      return { error: '指定された事業所が見つかりません' };
    }
  }

  // Create auth user
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
  if (authErr) return { error: authErr.message };

  // Insert public.users
  const { error: linkErr } = await supabase.from('users').insert({
    id: created.user.id,
    tenant_id: admin.tenantId,
    role: input.role,
    workplace_id: input.role === 'workplace_admin' ? input.workplaceId : null,
    display_name: input.displayName,
    email: input.email,
    is_active: true,
  });
  if (linkErr) return { error: linkErr.message };

  await supabase.from('audit_logs').insert({
    tenant_id: admin.tenantId,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'create',
    resource_type: 'user',
    resource_id: created.user.id,
    after_value: { email: input.email, role: input.role, display_name: input.displayName } as never,
    metadata: { source: 'master_users_form' } as never,
  });

  revalidatePath('/master/users');
  return { ok: true, userId: created.user.id };
}

export async function updateManagementUser(raw: unknown): Promise<UsersResult> {
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '入力が不正です' };
  const input = parsed.data;

  const admin = await ensureMaster();
  const supabase = createAdminClient();

  // Load target user
  const { data: target } = await supabase
    .from('users')
    .select('id, tenant_id, role, workplace_id, display_name, email, is_active')
    .eq('id', input.userId)
    .maybeSingle();
  if (!target) return { error: '対象ユーザーが見つかりません' };
  if (target.tenant_id !== admin.tenantId) return { error: '権限がありません' };

  // Prevent self-lockout: disabling self
  if (input.userId === admin.userId && !input.isActive) {
    return { error: '自分自身を無効化することはできません' };
  }
  // Prevent self role-change away from current role
  if (input.userId === admin.userId && target.role !== input.role) {
    return { error: '自分自身のロールは変更できません' };
  }

  // Validate workplace
  if (input.workplaceId) {
    const { data: wp } = await supabase
      .from('workplaces')
      .select('tenant_id')
      .eq('id', input.workplaceId)
      .maybeSingle();
    if (!wp || wp.tenant_id !== admin.tenantId) {
      return { error: '指定された事業所が見つかりません' };
    }
  }

  const updates = {
    display_name: input.displayName,
    role: input.role,
    workplace_id: input.role === 'workplace_admin' ? input.workplaceId : null,
    is_active: input.isActive,
  };

  const { error: updErr } = await supabase
    .from('users')
    .update(updates)
    .eq('id', input.userId);
  if (updErr) return { error: updErr.message };

  // Optional password reset
  if (input.newPassword) {
    const { error: pwErr } = await supabase.auth.admin.updateUserById(input.userId, {
      password: input.newPassword,
    });
    if (pwErr) return { error: `パスワード更新に失敗: ${pwErr.message}` };
  }

  await supabase.from('audit_logs').insert({
    tenant_id: admin.tenantId,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'update',
    resource_type: 'user',
    resource_id: input.userId,
    before_value: {
      role: target.role,
      workplace_id: target.workplace_id,
      display_name: target.display_name,
      is_active: target.is_active,
    } as never,
    after_value: { ...updates, password_reset: !!input.newPassword } as never,
    metadata: { source: 'master_users_form' } as never,
  });

  revalidatePath('/master/users');
  revalidatePath(`/master/users/${input.userId}`);
  return { ok: true, userId: input.userId };
}
