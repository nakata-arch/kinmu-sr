import { LoginForm } from './login-form';
import { clientEnv } from '@/lib/env';

export const metadata = {
  title: 'ログイン',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold">{clientEnv.NEXT_PUBLIC_BRAND_NAME}</h1>
        <p className="mb-6 text-sm text-gray-500">勤怠管理システム</p>
        <LoginForm />
      </div>
    </div>
  );
}
