import { LoginForm } from './login-form';
import { clientEnv } from '@/lib/env';

export const metadata = {
  title: 'ログイン',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-page-bg p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white px-8 py-10 shadow-sm">
        <p className="font-mono text-[11px] tracking-[0.15em] text-shacho-accent">SHACHO LOGIN</p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-shacho">
          {clientEnv.NEXT_PUBLIC_BRAND_NAME}
        </h1>
        <p className="mt-1 text-sm text-text-mid">勤怠管理システム</p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
