#!/usr/bin/env node
// One-shot seed: create the first tenant (ノース社労士) and the first
// shacho user. Idempotent on tenant (UPSERT by slug); will fail loudly
// if a user with the given email already exists in auth.users.
//
// Usage:
//   node --env-file=.env.local scripts/seed-initial.mjs <email> <password> [display_name]

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in env');
  process.exit(1);
}

const [email, password, displayName = '管理者'] = process.argv.slice(2);
if (!email || !password) {
  console.error(
    'Usage: node --env-file=.env.local scripts/seed-initial.mjs <email> <password> [display_name]',
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log('1/3  Creating tenant ノース社労士…');
const { data: tenant, error: tenantErr } = await supabase
  .from('tenants')
  .upsert(
    {
      slug: 'north-sr',
      name: 'ノース社労士',
      brand_name: 'ノース社労士',
      primary_color: '#1F3A5F',
    },
    { onConflict: 'slug' },
  )
  .select()
  .single();

if (tenantErr) {
  console.error('Tenant upsert failed:', tenantErr);
  process.exit(1);
}
console.log(`     tenant.id = ${tenant.id}`);

console.log(`2/3  Creating auth user (${email})…`);
const { data: created, error: authErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { display_name: displayName },
});
if (authErr) {
  console.error('Auth user creation failed:', authErr);
  process.exit(1);
}
console.log(`     auth.users.id = ${created.user.id}`);

console.log('3/3  Linking to public.users (role=shacho)…');
const { error: userErr } = await supabase.from('users').insert({
  id: created.user.id,
  tenant_id: tenant.id,
  role: 'shacho',
  display_name: displayName,
  email,
});
if (userErr) {
  console.error('public.users insert failed:', userErr);
  process.exit(1);
}

console.log('\nDone. You can now log in:');
console.log(`  URL:   http://localhost:3000/login`);
console.log(`  Email: ${email}`);
