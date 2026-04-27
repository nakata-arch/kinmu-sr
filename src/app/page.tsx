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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
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
      <LogoutButton />
    </main>
  );
}
