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

  const { data: workplaces } = await supabase
    .from('workplaces')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('name');

  return (
    <main className="min-h-svh bg-page-bg">
      {/* Header */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">DASHBOARD</p>
            <h1 className="font-serif text-2xl font-bold text-shacho">
              {clientEnv.NEXT_PUBLIC_BRAND_NAME}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium">{profile?.display_name ?? user.email}</div>
              <div className="text-xs text-text-light">
                {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : '未登録'}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        <section>
          <div className="mb-4 flex items-end justify-between border-b border-line pb-2">
            <h2 className="font-serif text-xl font-bold text-shacho">事業所</h2>
            <span className="text-xs text-text-light">
              {workplaces?.length ?? 0} 件
            </span>
          </div>

          {workplaces && workplaces.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {workplaces.map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/w/${w.slug}`}
                    className="block rounded-lg border border-line bg-white px-5 py-4 transition hover:border-shacho hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-semibold text-text-strong">{w.name}</div>
                        <div className="mt-1 font-mono text-xs text-text-light">/w/{w.slug}</div>
                      </div>
                      <span className="text-xs text-shacho-accent">→</span>
                    </div>
                    <p className="mt-2 text-xs text-text-mid">共有PC打刻ページを開く</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-mid">事業所が登録されていません。</p>
          )}

          <p className="mt-4 text-xs text-text-light">
            ※ 勤怠一覧・修正画面は Sprint 3 で順次追加予定
          </p>
        </section>
      </div>
    </main>
  );
}
