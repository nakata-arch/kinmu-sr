'use client';

import { useState, useTransition } from 'react';
import { login } from './actions';

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await login(formData);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="email" className="text-xs font-medium text-text-mid">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded border border-line px-3 py-2 text-sm text-text-strong outline-none focus:border-shacho focus:ring-2 focus:ring-shacho/20"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-xs font-medium text-text-mid">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="mt-1 w-full rounded border border-line px-3 py-2 text-sm text-text-strong outline-none focus:border-shacho focus:ring-2 focus:ring-shacho/20"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-shacho px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-shacho-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '送信中…' : 'ログイン'}
      </button>
    </form>
  );
}
