import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type UserRole = Database['public']['Enums']['user_role'];

export interface AdminContext {
  userId: string;
  email: string;
  displayName: string;
  role: Extract<UserRole, 'shacho' | 'workplace_admin' | 'bizpla_bpo'>;
  tenantId: string;
  workplaceId: string | null; // null for shacho/bpo (org-wide)
}

/**
 * Require an authenticated management role (shacho / workplace_admin / bizpla_bpo).
 * Redirects to /login when unauthenticated, to / when role is not one of those.
 *
 * If `requireWorkplaceSlug` is provided and the user is workplace_admin,
 * verifies they belong to that workplace; otherwise sends them home.
 */
export async function requireAdmin(opts?: {
  workplaceSlug?: string;
}): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id, workplace_id, display_name, email')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const allowed: UserRole[] = ['shacho', 'workplace_admin', 'bizpla_bpo'];
  if (!allowed.includes(profile.role)) redirect('/');

  // workplace_admin scoped to specific workplace
  if (opts?.workplaceSlug && profile.role === 'workplace_admin') {
    const { data: wp } = await supabase
      .from('workplaces')
      .select('id')
      .eq('slug', opts.workplaceSlug)
      .maybeSingle();
    if (!wp || wp.id !== profile.workplace_id) redirect('/');
  }

  return {
    userId: user.id,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role as AdminContext['role'],
    tenantId: profile.tenant_id,
    workplaceId: profile.workplace_id,
  };
}
