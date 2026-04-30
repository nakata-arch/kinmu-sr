import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { clientEnv } from '@/lib/env';
import { LogoutButton } from './logout-button';

const ROLE_LABEL: Record<string, string> = {
  shacho: '社労士',
  workplace_admin: '事業所管理者',
  employee: '従業員',
  bizpla_bpo: 'BPOオペレーター',
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role, tenant_id')
    .eq('id', user.id)
    .single();

  // RLS scopes this to the current user's tenant + workplace.
  const { data: workplaces } = await supabase
    .from('workplaces')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('name');

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{clientEnv.NEXT_PUBLIC_BRAND_NAME}</h1>
        <p className="text-sm text-gray-500">勤怠管理システム</p>
      </div>

      <div className="rounded border border-gray-200 px-6 py-4 text-center">
        <p className="text-lg">ようこそ、{profile?.display_name ?? user.email}さん</p>
        <p className="mt-1 text-sm text-gray-500">
          権限: {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : '未登録'}
        </p>
      </div>

      {workplaces && workplaces.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">事業所</h2>
          <ul className="space-y-2">
            {workplaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/w/${w.slug}`}
                  className="block rounded border border-gray-200 px-4 py-3 hover:border-gray-400 hover:bg-gray-50"
                >
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-gray-500">
                    /w/{w.slug} — 共有PC打刻ページ
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            ※ 管理画面（勤怠一覧・修正依頼・給与計算）は Sprint 3 以降で追加予定
          </p>
        </section>
      )}

      <div className="flex justify-center">
        <LogoutButton />
      </div>
    </main>
  );
}
