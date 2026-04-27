import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env';
import { getServerEnv } from '@/lib/env.server';

// Bypasses RLS. Use only for trusted server-side flows
// (e.g. token-based punch RPC, BPO admin operations).
export function createAdminClient() {
  return createSupabaseClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
