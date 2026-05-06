import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { formatHHMM } from '@/domain/attendance/calc';

export const metadata = { title: '給与計算 履歴' };
export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:      { label: '下書き',  cls: 'bg-text-light/15 text-text-mid' },
  calculated: { label: '計算済',  cls: 'bg-employee/15 text-employee-accent' },
  reviewing:  { label: 'レビュー中', cls: 'bg-warning/15 text-warning' },
  finalized:  { label: '確定済',  cls: 'bg-success/15 text-success' },
  exported:   { label: '出力済',  cls: 'bg-shacho/15 text-shacho' },
};

interface Props {
  params: Promise<{ slug: string }>;
}

interface RunRow {
  id: string;
  target_month: string;
  status: string;
  rules_version: number;
  finalized_at: string | null;
  summary: { employee_count?: number; total_overtime_minutes?: number; danger_alerts?: number; warning_alerts?: number } | null;
  users: { display_name: string } | null;
}

export default async function PayrollHistoryPage({ params }: Props) {
  const { slug } = await params;
  const admin = await requireAdmin({
    workplaceSlug: slug,
    rolesAllowed: ['shacho', 'bizpla_bpo'],
  });

  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  const { data: runsRaw } = await supabase
    .from('payroll_runs')
    .select('id, target_month, status, rules_version, finalized_at, summary, users:finalized_by(display_name)')
    .eq('workplace_id', workplace.id)
    .order('target_month', { ascending: false });

  const runs = (runsRaw ?? []) as unknown as RunRow[];

  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <AdminShell
      brandName={brandName}
      workplaceName={workplace.name}
      workplaceSlug={slug}
      user={admin}
      currentSection="payroll"
    >
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <Link href={`/admin/${slug}/payroll`} className="hover:underline">給与計算</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">履歴</span>
      </p>

      <div className="mb-5 flex items-end justify-between">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">
          給与計算 履歴 <span className="text-base font-medium text-text-mid">（{workplace.name}）</span>
        </h1>
        <Link
          href={`/admin/${slug}/payroll`}
          className="rounded border border-jigyosho bg-white px-3 py-1.5 text-xs font-semibold text-jigyosho hover:bg-jigyosho/5"
        >
          ← 当月の給与計算へ
        </Link>
      </div>

      <div className="overflow-hidden rounded border border-line bg-white">
        {runs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-mid">
            <p>まだ給与計算の履歴はありません。</p>
            <p className="mt-2 text-xs text-text-light">
              <Link href={`/admin/${slug}/payroll`} className="text-jigyosho hover:underline">
                /admin/{slug}/payroll
              </Link>
              {' '}で月を選び、最終確定すると履歴に記録されます。
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-page-bg text-xs text-text-mid">
              <tr>
                <Th>対象月</Th>
                <Th>ステータス</Th>
                <Th>ルール</Th>
                <Th>従業員数</Th>
                <Th>残業合計</Th>
                <Th>警告</Th>
                <Th>確定者</Th>
                <Th>確定日時</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((r) => {
                const monthYmd = r.target_month.slice(0, 7);
                const monthLabel = formatInTimeZone(new Date(`${r.target_month}T00:00:00+09:00`), TZ, 'yyyy年M月');
                const cfg = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'bg-text-light/15 text-text-mid' };
                const summary = r.summary ?? {};
                return (
                  <tr key={r.id} className="hover:bg-page-bg">
                    <td className="px-3 py-2 font-mono">{monthLabel}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">v{r.rules_version}</td>
                    <td className="px-3 py-2 font-mono">{summary.employee_count ?? '—'}</td>
                    <td className="px-3 py-2 font-mono">{formatHHMM(summary.total_overtime_minutes ?? null)}</td>
                    <td className="px-3 py-2 text-xs">
                      {(summary.danger_alerts ?? 0) > 0 && (
                        <span className="mr-2 text-danger">danger: {summary.danger_alerts}</span>
                      )}
                      {(summary.warning_alerts ?? 0) > 0 && (
                        <span className="text-warning">warn: {summary.warning_alerts}</span>
                      )}
                      {(summary.danger_alerts ?? 0) === 0 && (summary.warning_alerts ?? 0) === 0 && (
                        <span className="text-text-light">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.users?.display_name ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-mid">
                      {r.finalized_at
                        ? formatInTimeZone(new Date(r.finalized_at), TZ, 'yyyy-MM-dd HH:mm')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/${slug}/payroll?month=${monthYmd}`}
                        className="mr-2 rounded border border-line bg-white px-2 py-1 text-[11px] text-jigyosho hover:border-jigyosho hover:bg-jigyosho/5"
                      >
                        開く
                      </Link>
                      <a
                        href={`/api/export/csv?slug=${slug}&month=${monthYmd}`}
                        className="rounded border border-line bg-white px-2 py-1 text-[11px] text-text-mid hover:border-text-light hover:text-text-strong"
                      >
                        CSV
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-[11px] text-text-light">
        ※ summary は最終確定時点のスナップショット。再計算すると数字が変わる可能性があります。
      </p>
    </AdminShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
