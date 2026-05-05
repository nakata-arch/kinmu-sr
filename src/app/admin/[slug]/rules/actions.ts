'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import type { CalculationRules } from '@/domain/rule-engine/types';

const DAY_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const RulesSchema = z.object({
  workplaceSlug: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(300).nullable(),
  rules: z.object({
    basic: z.object({
      scheduledWorkMinutesPerDay: z.number().int().min(60).max(720),
      scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/),
      scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/),
      breakMinutes: z.number().int().min(0).max(480),
      weeklyHolidays: z.array(z.enum(DAY_OF_WEEK)),
    }),
    overtime: z.object({
      definition: z.enum(['beyond_scheduled', 'beyond_legal']),
      fixedOvertimeMinutes: z.number().int().min(0).max(20000),
      nightStartTime: z.string().regex(/^\d{2}:\d{2}$/),
      nightEndTime: z.string().regex(/^\d{2}:\d{2}$/),
      over60hEnabled: z.boolean(),
    }),
    holiday: z.object({
      legalHoliday: z.enum(DAY_OF_WEEK),
      companyHolidays: z.array(z.enum(DAY_OF_WEEK)),
      customHolidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    }),
    allowance: z.object({
      weekdayOvertimeRate: z.number().min(0).max(2),
      nightOvertimeRate: z.number().min(0).max(2),
      legalHolidayRate: z.number().min(0).max(2),
      companyHolidayRate: z.number().min(0).max(2),
      over60hRate: z.number().min(0).max(2),
    }),
    agreement36: z.object({
      monthlyLimitMinutes: z.number().int().min(60).max(60 * 200),
      yearlyLimitMinutes: z.number().int().min(60).max(60 * 1000),
      warningThresholdPercent: z.number().min(0).max(1),
    }),
  }),
});

export type SaveRulesInput = z.infer<typeof RulesSchema>;
export type SaveRulesResult = { ok: true; version: number } | { error: string };

export async function saveRules(raw: unknown): Promise<SaveRulesResult> {
  const parsed = RulesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? '入力が不正です' };
  }
  const input = parsed.data;

  const admin = await requireAdmin({
    workplaceSlug: input.workplaceSlug,
    rolesAllowed: ['shacho', 'bizpla_bpo'], // SPEC §6.3
  });

  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, tenant_id')
    .eq('slug', input.workplaceSlug)
    .maybeSingle();
  if (!workplace) return { error: '事業所が見つかりません' };

  // Latest version
  const { data: latest } = await supabase
    .from('calculation_rules')
    .select('id, version, effective_from')
    .eq('workplace_id', workplace.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  // effective_until on previous = day before new effective_from
  if (latest) {
    const dayBefore = new Date(`${input.effectiveFrom}T00:00:00+09:00`);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const dayBeforeYmd = dayBefore.toISOString().slice(0, 10);
    await supabase
      .from('calculation_rules')
      .update({ effective_until: dayBeforeYmd })
      .eq('id', latest.id);
  }

  const rulesPayload: CalculationRules = {
    version: nextVersion,
    ...input.rules,
  };

  const { error: insErr } = await supabase.from('calculation_rules').insert({
    tenant_id: workplace.tenant_id,
    workplace_id: workplace.id,
    version: nextVersion,
    effective_from: input.effectiveFrom,
    rules: rulesPayload as never,
    note: input.note,
    created_by: admin.userId,
  });
  if (insErr) return { error: insErr.message };

  await supabase.from('audit_logs').insert({
    tenant_id: workplace.tenant_id,
    actor_id: admin.userId,
    actor_role: admin.role,
    action: 'create',
    resource_type: 'calculation_rule',
    resource_id: null,
    after_value: { version: nextVersion, effective_from: input.effectiveFrom } as never,
    metadata: { source: 'admin_rules_form' } as never,
  });

  revalidatePath(`/admin/${input.workplaceSlug}/rules`);
  revalidatePath(`/admin/${input.workplaceSlug}/payroll`);
  return { ok: true, version: nextVersion };
}
