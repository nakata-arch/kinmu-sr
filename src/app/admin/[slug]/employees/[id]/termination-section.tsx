'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { terminateEmployee } from '../actions';

interface Props {
  workplaceSlug: string;
  employeeId: string;
  isActive: boolean;
  terminatedAt: string | null;
  defaultDate: string; // today (YYYY-MM-DD) — used as default
}

export function TerminationSection({
  workplaceSlug,
  employeeId,
  isActive,
  terminatedAt,
  defaultDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!isActive) {
    return (
      <div className="rounded border border-line bg-page-bg p-4">
        <p className="text-xs font-semibold text-text-mid">退職処理</p>
        <p className="mt-2 text-sm text-text-strong">
          退職日: <span className="font-mono">{terminatedAt ?? '未設定'}</span>
        </p>
        <p className="mt-2 text-[11px] text-text-light">
          このアカウントは無効化されています。打刻URL（/p/[token]）を開いても 404 になります。
        </p>
      </div>
    );
  }

  const submit = () => {
    if (!confirm(`${date} 付けで退職処理します。打刻URLは即座に無効化されます。続行しますか？`)) return;
    setError(null);
    startTransition(async () => {
      const res = await terminateEmployee({
        workplaceSlug,
        employeeId,
        terminatedAt: date,
      });
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="rounded border border-danger/30 bg-danger/5 p-4">
      <p className="text-xs font-semibold text-danger">退職処理</p>
      <p className="mt-2 text-xs text-text-mid">
        退職日を設定すると、以後の打刻ができなくなります。
      </p>
      {open ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-text-mid">
            退職日
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ml-2 rounded border border-line bg-white px-2 py-1 text-sm font-mono"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
            >
              {pending ? '処理中…' : '退職処理を確定'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-line bg-white px-3 py-1.5 text-xs"
            >
              キャンセル
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded border border-danger/50 bg-white px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5"
        >
          退職日を設定…
        </button>
      )}
    </div>
  );
}
