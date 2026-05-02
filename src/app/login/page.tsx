import { LoginForm } from './login-form';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = {
  title: 'ログイン',
};
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Phase 1 has a single tenant; fetch its brand for the login chrome.
  // Multi-tenant Phase 3 will pick by subdomain.
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('brand_name')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const brandName = tenant?.brand_name ?? '勤怠管理システム';

  return (
    <div className="flex min-h-svh items-center justify-center bg-page-bg p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white px-8 py-10 shadow-sm">
        <p className="font-mono text-[11px] tracking-[0.15em] text-shacho-accent">
          MANAGEMENT LOGIN
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-shacho">{brandName}</h1>
        <p className="mt-1 text-sm text-text-mid">勤怠管理システム</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-[11px] text-text-light">
          社労士・事業所管理者の方はこのページからログインしてください。
        </p>
      </div>
    </div>
  );
}
