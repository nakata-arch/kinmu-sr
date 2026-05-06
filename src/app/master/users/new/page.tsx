import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { LogoutButton } from '@/app/logout-button';
import { UserForm } from '../user-form';

export const metadata = { title: 'ユーザー追加' };
export const dynamic = 'force-dynamic';

export default async function NewUserPage() {
  const admin = await requireAdmin({ rolesAllowed: ['shacho', 'bizpla_bpo'] });
  const supa = createAdminClient();

  const { data: workplaces } = await supa
    .from('workplaces')
    .select('id, name')
    .eq('tenant_id', admin.tenantId)
    .eq('is_active', true)
    .order('name');

  return (
    <main className="min-h-svh bg-page-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">MASTER</p>
            <h1 className="font-serif text-2xl font-bold text-shacho">ユーザー追加</h1>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-3 text-xs text-text-light">
          <Link href="/" className="hover:underline">ダッシュボード</Link>
          <span className="mx-1">/</span>
          <Link href="/master/users" className="hover:underline">ユーザー管理</Link>
          <span className="mx-1">/</span>
          <span className="text-text-mid">新規追加</span>
        </p>

        <div className="rounded border border-line bg-white p-6">
          <UserForm
            userId={null}
            email=""
            displayName=""
            role="workplace_admin"
            workplaceId={null}
            isActive={true}
            workplaces={workplaces ?? []}
            cancelHref="/master/users"
            isSelf={false}
          />
        </div>
      </div>
    </main>
  );
}
