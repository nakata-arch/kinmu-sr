'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { regeneratePunchToken } from '../actions';

interface Props {
  workplaceSlug: string;
  employeeId: string;
  punchToken: string;
  baseUrl: string;
}

export function TokenSection({ workplaceSlug, employeeId, punchToken, baseUrl }: Props) {
  const url = `${baseUrl}/p/${punchToken}`;
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('コピーに失敗しました');
    }
  };

  const regen = () => {
    if (!confirm('現在のURLは即座に無効化され、新しいURLが発行されます。続行しますか？')) return;
    setError(null);
    startTransition(async () => {
      const res = await regeneratePunchToken({ workplaceSlug, employeeId });
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="rounded border border-line bg-page-bg p-4">
      <p className="mb-2 text-xs font-semibold text-text-mid">📱 個人打刻URL</p>
      <code className="block break-all rounded border border-line bg-white px-3 py-2 text-xs">
        {baseUrl}/p/<span className="font-bold text-employee-accent">{punchToken}</span>
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded bg-jigyosho px-3 py-1.5 text-xs font-semibold text-white hover:bg-jigyosho-accent"
        >
          {copied ? '✓ コピーしました' : '📋 URLコピー'}
        </button>
        <button
          type="button"
          disabled
          title="Sprint 3-4 以降で実装予定"
          className="cursor-not-allowed rounded border border-line bg-white px-3 py-1.5 text-xs text-text-light"
        >
          🖨 QRコード印刷
        </button>
        <button
          type="button"
          onClick={regen}
          disabled={pending}
          className="rounded border border-danger/50 bg-white px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
        >
          {pending ? '再発行中…' : '🔄 再発行'}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-text-light">
        ※ 再発行すると古いURLは即座に無効化されます。
      </p>
      {error && (
        <p className="mt-2 text-xs text-danger">{error}</p>
      )}
    </div>
  );
}
