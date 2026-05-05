'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { finalizePayroll } from './actions';

interface Props {
  workplaceSlug: string;
  monthYmd: string;
  monthLabel: string;
  /** Already finalized run summary */
  finalized: null | {
    finalizedAt: string; // formatted
    finalizedBy: string;
  };
  /** Has at least one alert that should be addressed before locking */
  hasDangerAlerts: boolean;
  /** Whether the current user is allowed to finalize (shacho only) */
  canFinalize: boolean;
}

export function FinalizeSection({
  workplaceSlug,
  monthYmd,
  monthLabel,
  finalized,
  hasDangerAlerts,
  canFinalize,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (finalized) {
    return (
      <div className="rounded border border-success/30 bg-success/5 px-4 py-3 text-sm">
        <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
          ✓ 確定済
        </span>
        <span className="ml-3 text-text-strong">
          {monthLabel} の給与計算は最終確定済みです。
        </span>
        <span className="ml-2 text-xs text-text-light">
          ({finalized.finalizedAt} / {finalized.finalizedBy})
        </span>
        <p className="mt-1 text-[11px] text-text-light">
          この月の勤怠記録は status=finalized でロックされており、編集できません。
        </p>
      </div>
    );
  }

  if (!canFinalize) {
    return (
      <div className="rounded border border-line bg-page-bg px-4 py-3 text-xs text-text-mid">
        ※ 「最終確定」は社労士権限のユーザーのみ実行できます。
      </div>
    );
  }

  const submit = () => {
    const msg =
      `${monthLabel} の勤怠データをロックし、給与計算を最終確定します。\n\n` +
      (hasDangerAlerts
        ? '⚠ 36協定上限超過のアラートがあります。先に対応する事をおすすめします。\n\n'
        : '') +
      '確定後は勤怠記録を変更できなくなります。続行しますか？';
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await finalizePayroll({ workplaceSlug, monthYmd });
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="rounded border border-danger/30 bg-danger/5 p-4">
      <p className="text-xs font-semibold text-danger">最終確定</p>
      <p className="mt-1 text-xs text-text-mid">
        計算結果を payroll_runs に保存し、{monthLabel} の勤怠記録をロックします。
        以降は勤怠の編集ができなくなります。
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-3 rounded bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
      >
        {pending ? '確定中…' : `${monthLabel} の給与計算を最終確定`}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
