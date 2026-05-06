import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { LogoutButton } from '@/app/logout-button';
import { UserForm } from '../user-form';

export const metadata = { title: 'ユーザー編集' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params;
  const admin = await requireAdmin({ rolesAllowed: ['shacho', 'bizpla_bpo'] });
  const supa = createAdminClient();

  const { data: user } = await supa
    .from('users')
    .select('id, email, display_name, role, workplace_id, is_active, tenant_id')
    .eq('id', id)
    .maybeSingle();
  if (!user || user.tenant_id !== admin.tenantId) notFound();

  const { data: workplaces } = await supa
    .from('workplaces')
    .select('id, name')
    .eq('tenant_id', admin.tenantId)
    .eq('is_active', true)
    .order('name');

  const isSelf = user.id === admin.userId;
  const role: 'shacho' | 'workplace_admin' | 'bizpla_bpo' =
    user.role === 'shacho' || user.role === 'workplace_admin' || user.role === 'bizpla_bpo'
      ? user.role
      : 'workplace_admin';

  return (
    <main className="min-h-svh bg-page-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">MASTER</p>
            <h1 className="font-serif text-2xl font-bold text-shacho">ユーザー編集</h1>
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
          <span className="text-text-mid">{user.display_name}</span>
        </p>

        <div className="mb-4">
          <h2 className="font-serif text-xl font-bold text-shacho">{user.display_name}</h2>
          <p className="mt-0.5 text-xs text-text-mid font-mono">{user.email}</p>
          {isSelf && (
            <p className="mt-1 text-[11px] text-warning">
              ※ 自分自身を編集中です。ロール変更・無効化は できません。
            </p>
          )}
        </div>

        <div className="rounded border border-line bg-white p-6">
          <UserForm
            userId={user.id}
            email={user.email}
            displayName={user.display_name}
            role={role}
            workplaceId={user.workplace_id}
            isActive={user.is_active}
            workplaces={workplaces ?? []}
            cancelHref="/master/users"
            isSelf={isSelf}
          />
        </div>
      </div>
    </main>
  );
}
