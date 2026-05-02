#!/usr/bin/env node
// Seed: workplaces 事業所B, 事業所C, 事業所D (each with 7 placeholder
// employees + fresh punch_tokens) and one workplace_admin user per
// workplace (4 total: 事業所A, B, C, D).
//
// Usage:
//   node --env-file=.env.local scripts/seed-extra.mjs <password>
//
// Idempotent:
//   - Workplaces B/C/D upserted by (tenant_id, slug)
//   - Employees skipped per workplace if any already present
//   - Admin users skipped if email already linked in public.users

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node --env-file=.env.local scripts/seed-extra.mjs <password>');
  console.error('  <password>: shared password for all 4 workplace_admin accounts (≥8 chars)');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const NEW_WORKPLACES = [
  {
    slug: 'site-b',
    name: '事業所B',
    employees: [
      { last: '中村', first: '大輔' },
      { last: '小林', first: '智子' },
      { last: '加藤', first: '美香' },
      { last: '吉田', first: '健'   },
      { last: '山本', first: 'さくら' },
      { last: '松本', first: '順子' },
      { last: '井上', first: '達也' },
    ],
  },
  {
    slug: 'site-c',
    name: '事業所C',
    employees: [
      { last: '木村', first: '翔'   },
      { last: '林',   first: '裕子' },
      { last: '清水', first: '拓也' },
      { last: '山崎', first: '彩'   },
      { last: '池田', first: '勇気' },
      { last: '橋本', first: '麻衣' },
      { last: '阿部', first: '俊介' },
    ],
  },
  {
    slug: 'site-d',
    name: '事業所D',
    employees: [
      { last: '石川', first: '亮'   },
      { last: '山下', first: '萌'   },
      { last: '中島', first: '浩二' },
      { last: '前田', first: '由香' },
      { last: '藤田', first: '修平' },
      { last: '小川', first: '千夏' },
      { last: '岡田', first: '大樹' },
    ],
  },
];

console.log('Locating tenant…');
const { data: tenant, error: tenantErr } = await supabase
  .from('tenants')
  .select('id, name')
  .eq('slug', 'sr-a')
  .single();
if (tenantErr || !tenant) {
  console.error('Tenant sr-a not found. Run scripts/seed-initial.mjs first.');
  process.exit(1);
}
console.log(`  ${tenant.name} (${tenant.id})\n`);

// --------- 1. Upsert workplaces B/C/D ---------
console.log('=== 1. Workplaces (B/C/D, idempotent) ===');
for (const wp of NEW_WORKPLACES) {
  const { data, error } = await supabase
    .from('workplaces')
    .upsert(
      {
        tenant_id: tenant.id,
        slug: wp.slug,
        name: wp.name,
        bpo_plan: 'light',
        contract_start: '2026-04-01',
      },
      { onConflict: 'tenant_id,slug' },
    )
    .select('id, slug, name')
    .single();
  if (error) {
    console.error(`  ✗ ${wp.name}:`, error.message);
    process.exit(1);
  }
  wp.id = data.id;
  console.log(`  ✓ ${data.name} (${data.slug}) → ${data.id}`);
}

// --------- 2. Employees per workplace ---------
console.log('\n=== 2. Employees (7 per workplace, fresh tokens) ===');
const empUrls = [];
for (const wp of NEW_WORKPLACES) {
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('workplace_id', wp.id);

  if ((count ?? 0) > 0) {
    console.log(`  ▸ ${wp.name}: already has ${count} employees — skipping`);
    continue;
  }

  const letter = wp.slug.slice(-1).toUpperCase(); // B / C / D
  const rows = wp.employees.map((e, i) => ({
    tenant_id: tenant.id,
    workplace_id: wp.id,
    employee_code: `${letter}${String(i + 1).padStart(3, '0')}`,
    last_name: e.last,
    first_name: e.first,
    employment_type: 'regular',
    hired_at: '2026-04-01',
    punch_token: randomBytes(24).toString('base64url'),
  }));

  const { data: inserted, error: empErr } = await supabase
    .from('employees')
    .insert(rows)
    .select('last_name, first_name, employee_code, punch_token');
  if (empErr) {
    console.error(`  ✗ ${wp.name} insert:`, empErr.message);
    process.exit(1);
  }
  console.log(`  ✓ ${wp.name}: inserted ${inserted.length} employees`);
  empUrls.push({ workplace: wp.name, slug: wp.slug, employees: inserted });
}

// --------- 3. Workplace admins (1 per workplace, all 4) ---------
console.log('\n=== 3. Workplace admins (1 per workplace) ===');
const { data: allWps } = await supabase
  .from('workplaces')
  .select('id, slug, name')
  .eq('tenant_id', tenant.id)
  .eq('is_active', true)
  .order('slug');

const adminLogins = [];
for (const wp of allWps ?? []) {
  const suffix = wp.slug.slice(-1); // a/b/c/d
  const email = `admin-${suffix}@example.com`;
  const displayName = `管理者${suffix.toUpperCase()}`;

  const { data: existing } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    console.log(`  ▸ ${displayName} (${email}) already exists — skipping`);
    adminLogins.push({ email, displayName, workplace: wp.name, status: 'existing' });
    continue;
  }

  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (authErr) {
    console.error(`  ✗ ${displayName} createUser:`, authErr.message);
    continue;
  }

  const { error: userErr } = await supabase.from('users').insert({
    id: created.user.id,
    tenant_id: tenant.id,
    role: 'workplace_admin',
    workplace_id: wp.id,
    display_name: displayName,
    email,
  });
  if (userErr) {
    console.error(`  ✗ ${displayName} public.users:`, userErr.message);
    continue;
  }

  console.log(`  ✓ ${displayName} (${email}) created`);
  adminLogins.push({ email, displayName, workplace: wp.name, status: 'new' });
}

// --------- Output ---------
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

console.log('\n========================================');
console.log('LOGIN URLS');
console.log('========================================');
console.log(`Login page: ${baseUrl}/login\n`);
console.log('Workplace admin accounts:');
for (const a of adminLogins) {
  const flag = a.status === 'new' ? '🆕' : '  ';
  console.log(`  ${flag} ${a.displayName}  email: ${a.email}  workplace: ${a.workplace}`);
}
console.log(`\n  password (shared): ${password}`);
console.log('  (Change via Supabase Dashboard → Auth or build a UI in Sprint 3+)\n');

if (empUrls.length > 0) {
  console.log('========================================');
  console.log('NEW EMPLOYEE TOKEN URLS');
  console.log('========================================');
  for (const w of empUrls) {
    console.log(`\n${w.workplace} (${baseUrl}/w/${w.slug}):`);
    for (const e of w.employees) {
      console.log(
        `  ${e.employee_code} ${e.last_name}${e.first_name}: ${baseUrl}/p/${e.punch_token}`,
      );
    }
  }
  console.log('');
}
