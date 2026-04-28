#!/usr/bin/env node
// Seed: カムフラット社 (workplace) + 7 placeholder employees with
// freshly generated punch_tokens. Idempotent: re-running with employees
// already present is a no-op (so you don't accidentally rotate tokens).
//
// Usage: node --env-file=.env.local scripts/seed-camuflat.mjs

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('1/4  Locating tenant ノース社労士…');
const { data: tenant, error: tenantErr } = await supabase
  .from('tenants')
  .select('id')
  .eq('slug', 'north-sr')
  .single();
if (tenantErr || !tenant) {
  console.error('No tenant with slug=north-sr. Run seed-initial.mjs first.');
  process.exit(1);
}
console.log(`     tenant.id = ${tenant.id}`);

console.log('2/4  Upserting workplace カムフラット社 (slug=camuflat)…');
const { data: workplace, error: wpErr } = await supabase
  .from('workplaces')
  .upsert(
    {
      tenant_id: tenant.id,
      slug: 'camuflat',
      name: 'カムフラット社',
      bpo_plan: 'light',
      contract_start: '2026-04-01',
    },
    { onConflict: 'tenant_id,slug' },
  )
  .select()
  .single();
if (wpErr) {
  console.error('Workplace upsert failed:', wpErr);
  process.exit(1);
}
console.log(`     workplace.id = ${workplace.id}`);

console.log('3/4  Checking existing employees…');
const { count } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true })
  .eq('workplace_id', workplace.id);

if ((count ?? 0) > 0) {
  console.log(`     カムフラット社 already has ${count} employee(s). Skipping insert.`);
  console.log('     (Delete or rotate tokens via the admin UI in Sprint 3.)');
  process.exit(0);
}

console.log('4/4  Inserting 7 placeholder employees with fresh punch tokens…');
const placeholders = [
  { last_name: '山田', first_name: '太郎', employee_code: 'E001' },
  { last_name: '鈴木', first_name: '花子', employee_code: 'E002' },
  { last_name: '佐藤', first_name: '健一', employee_code: 'E003' },
  { last_name: '田中', first_name: '美香', employee_code: 'E004' },
  { last_name: '高橋', first_name: '誠',   employee_code: 'E005' },
  { last_name: '伊藤', first_name: '由紀', employee_code: 'E006' },
  { last_name: '渡辺', first_name: '隆',   employee_code: 'E007' },
];

const rows = placeholders.map((e) => ({
  tenant_id: tenant.id,
  workplace_id: workplace.id,
  employment_type: 'regular',
  hired_at: '2026-04-01',
  punch_token: randomBytes(24).toString('base64url'),
  ...e,
}));

const { data: inserted, error: empErr } = await supabase
  .from('employees')
  .insert(rows)
  .select('id, last_name, first_name, employee_code, punch_token');
if (empErr) {
  console.error('Employee insert failed:', empErr);
  process.exit(1);
}

console.log(`     Inserted ${inserted.length} employees.\n`);

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
console.log('=== Test URLs ===');
console.log(`Shared PC: ${baseUrl}/w/camuflat\n`);
console.log('Personal mobile (per employee):');
for (const e of inserted) {
  console.log(
    `  ${e.employee_code} ${e.last_name}${e.first_name}: ${baseUrl}/p/${e.punch_token}`,
  );
}
