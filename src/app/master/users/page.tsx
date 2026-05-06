import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { LogoutButton } from '@/app/logout-button';

export const metadata = { title: 'ユーザー管理' };
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  shacho: '社労士',
  workplace_admin: '事業所管理者',
  bizpla_bpo: 'BPO',
};

const ROLE_BADGE_CLS: Record<string, string> = {
  shacho:          'bg-shacho/15 text-shacho',
  workplace_admin: 'bg-jigyosho/15 text-jigyosho',
  bizpla_bpo:      'bg-employee/15 text-employee-accent',
};

export default async function UsersPage() {
  const admin = await requireAdmin({ rolesAllowed: ['shacho', 'bizpla_bpo'] });

  // Use authenticated client for header/profile
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, tenants(brand_name)')
    .eq('id', admin.userId)
    .single();
  const brandName = profile?.tenants?.brand_name ?? '';

  // Use admin client to load all tenant users (RLS would also work but admin
  // is consistent with our other master pages).
  const supa = createAdminClient();
  const { data: users } = await supa
    .from('users')
    .select('id, email, display_name, role, workplace_id, is_active, last_login_at, workplaces(name)')
    .eq('tenant_id', admin.tenantId)
    .order('role')
    .order('display_name');

  return (
    <main className="min-h-svh bg-page-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">MASTER</p>
            <h1 className="font-serif text-2xl font-bold text-shacho">{brandName} ユーザー管理</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-xs text-text-mid hover:underline">
              ← ダッシュボード
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-serif text-xl font-bold text-shacho">管理ユーザー一覧</h2>
          <Link
            href="/master/users/new"
            className="rounded bg-shacho px-4 py-2 text-sm font-semibold text-white hover:bg-shacho-accent"
          >
            ＋ 新規追加
          </Link>
        </div>

        <div className="overflow-hidden rounded border border-line bg-white">
          {users && users.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-page-bg text-xs text-text-mid">
                <tr>
                  <Th>表示名</Th>
                  <Th>メール</Th>
                  <Th>ロール</Th>
                  <Th>所属事業所</Th>
                  <Th>状態</Th>
                  <Th>最終ログイン</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const cls = ROLE_BADGE_CLS[u.role] ?? 'bg-text-light/15 text-text-mid';
                  return (
                    <tr key={u.id} className={!u.is_active ? 'bg-page-bg text-text-light' : ''}>
                      <td className="px-3 py-2 font-medium">
                        {u.display_name}
                        {u.id === admin.userId && (
                          <span className="ml-2 rounded bg-text-light/15 px-1.5 py-0.5 text-[10px]">
                            自分
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {u.workplace_id && u.workplaces?.name ? u.workplaces.name : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {u.is_active ? (
                          <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                            有効
                          </span>
                        ) : (
                          <span className="rounded bg-text-light/15 px-2 py-0.5 text-[10px] font-semibold text-text-mid">
                            無効
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-text-mid">
                        {u.last_login_at?.slice(0, 19).replace('T', ' ') ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/master/users/${u.id}`}
                          className="rounded border border-line bg-white px-2 py-1 text-[11px] text-jigyosho hover:border-jigyosho hover:bg-jigyosho/5"
                        >
                          編集
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-text-mid">
              ユーザーが登録されていません。
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
