import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { formatHHMM } from '@/domain/attendance/calc';
import { loadPayrollMonth } from '@/server/payroll-loader';

export const metadata = { title: '給与計算' };
export const dynamic = 'force-dynamic';

function recentMonths(count = 6): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const baseY = Number(formatInTimeZone(now, TZ, 'yyyy'));
  const baseM = Number(formatInTimeZone(now, TZ, 'M'));
  for (let i = 0; i < count; i++) {
    const m = baseM - i;
    const y = baseY + Math.floor((m - 1) / 12);
    const month = ((m - 1 + 1200) % 12) + 1;
    const value = `${y}-${month.toString().padStart(2, '0')}`;
    const label = `${y}年${month}月`;
    out.push({ value, label });
  }
  return out;
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}

export default async function PayrollPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const admin = await requireAdmin({
    workplaceSlug: slug,
    rolesAllowed: ['shacho', 'bizpla_bpo'],
  });

  const months = recentMonths(6);
  const monthValue =
    sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0].value;
  const monthLabel = months.find((m) => m.value === monthValue)?.label ?? monthValue;

  const supabase = createAdminClient();
  const { data: wpHeader } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!wpHeader) notFound();

  const result = await loadPayrollMonth({ workplaceSlug: slug, monthYmd: monthValue });
  if (!result) notFound();

  const dangerCount = result.employees.filter((e) =>
    e.result.alerts.some((a) => a.severity === 'danger'),
  ).length;
  const warningCount = result.employees.filter((e) =>
    e.result.alerts.some((a) => a.severity === 'warning'),
  ).length;

  const brandName = wpHeader.tenants?.brand_name ?? '';

  return (
    <AdminShell
      brandName={brandName}
      workplaceName={wpHeader.name}
      workplaceSlug={slug}
      user={admin}
      currentSection="payroll"
    >
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">給与計算 / {monthLabel}</span>
      </p>

      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-jigyosho">
            給与計算 <span className="text-base font-medium text-text-mid">{monthLabel}</span>
          </h1>
          <p className="mt-1 text-xs text-text-light">
            ルールバージョン v{result.rulesVersion}
            {result.rulesVersion === 0 && (
              <span className="ml-2 rounded bg-warning/10 px-2 py-0.5 text-warning">
                ※ デフォルトルール使用中（事業所別ルールは未設定）
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <a
            href={`/api/export/csv?slug=${slug}&month=${monthValue}`}
            className="rounded border border-line bg-white px-3 py-1.5 text-jigyosho hover:border-jigyosho hover:bg-jigyosho/5"
          >
            CSV出力
          </a>
          <button
            type="button"
            disabled
            title="次回スプリントで実装予定"
            className="cursor-not-allowed rounded border border-line bg-white px-3 py-1.5 text-text-light"
          >
            最終確定（社労士のみ）
          </button>
        </div>
      </div>

      {/* Filter (month) */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-3 rounded border border-line bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-xs text-text-mid">
          対象月
          <select
            name="month"
            defaultValue={monthValue}
            className="rounded border border-line bg-white px-2 py-1 text-sm"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded bg-jigyosho px-3 py-1.5 text-xs font-semibold text-white hover:bg-jigyosho-accent"
        >
          適用
        </button>
      </form>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="対象人数" value={`${result.employees.length} 名`} />
        <Stat
          label="勤怠確定率"
          value={`${Math.round(result.attendanceConfirmedRate * 100)}%`}
          hint={`(${result.approvedCount} / ${result.totalAttendanceRecords})`}
        />
        <Stat
          label="36協定 警告"
          value={`${dangerCount + warningCount} 件`}
          hint={dangerCount > 0 ? `内 dangerous: ${dangerCount}` : undefined}
          tone={dangerCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border border-line bg-white">
        {result.employees.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-text-mid">
            この事業所には在籍中の従業員がいません。
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-page-bg text-xs text-text-mid">
              <tr>
                <Th>氏名</Th>
                <ThNum>所定内</ThNum>
                <ThNum>法定内残業</ThNum>
                <ThNum>法定外残業</ThNum>
                <ThNum>60h超</ThNum>
                <ThNum>深夜</ThNum>
                <ThNum>法定休日</ThNum>
                <ThNum>所定休日</ThNum>
                <ThNum>有給</ThNum>
                <ThNum>欠勤</ThNum>
                <Th>状態</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.employees.map((e) => {
                const danger = e.result.alerts.some((a) => a.severity === 'danger');
                const warning = e.result.alerts.some((a) => a.severity === 'warning');
                const tone = danger ? 'bg-danger/[0.04]' : warning ? 'bg-warning/[0.05]' : '';
                return (
                  <tr key={e.id} className={tone}>
                    <td className="px-3 py-2">
                      <span className="mr-2 font-mono text-[10px] text-text-light">
                        {e.employeeCode}
                      </span>
                      <span className="font-medium">{e.lastName} {e.firstName}</span>
                    </td>
                    <TdNum>{formatHHMM(e.result.regularWorkMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.overtimeLegalMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.overtimeStatutoryMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.over60hMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.nightWorkMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.holidayLegalMinutes)}</TdNum>
                    <TdNum>{formatHHMM(e.result.holidayCompanyMinutes)}</TdNum>
                    <TdNum>{e.result.paidLeaveDays}日</TdNum>
                    <TdNum>{e.result.absenceDays}日</TdNum>
                    <td className="px-3 py-2">
                      {danger ? (
                        <span className="rounded bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
                          要対応
                        </span>
                      ) : warning ? (
                        <span className="rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                          警告
                        </span>
                      ) : (
                        <span className="text-[10px] text-text-light">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alerts detail */}
      {(dangerCount > 0 || warningCount > 0) && (
        <div className="mt-5 rounded border border-warning/30 bg-warning/5 p-4">
          <p className="mb-2 text-xs font-semibold text-warning">⚠ 36協定アラート詳細</p>
          <ul className="space-y-1 text-xs text-text-mid">
            {result.employees
              .filter((e) => e.result.alerts.length > 0)
              .map((e) =>
                e.result.alerts.map((a, i) => (
                  <li key={`${e.id}-${i}`}>
                    <span className="font-mono text-[10px] text-text-light">{e.employeeCode}</span>{' '}
                    <span className="font-medium text-text-strong">{e.lastName} {e.firstName}</span>
                    <span
                      className={
                        'ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                        (a.severity === 'danger'
                          ? 'bg-danger/15 text-danger'
                          : 'bg-warning/15 text-warning')
                      }
                    >
                      {a.severity}
                    </span>
                    <span className="ml-2">{a.message}</span>
                  </li>
                )),
              )}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] text-text-light">
        ※ 値は都度計算（payroll_runs 永続化なし）。最終確定 + ルールバージョン管理は次回スプリントで実装予定。
      </p>
    </AdminShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function ThNum({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-right font-medium">{children}</th>;
}
function TdNum({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2 text-right font-mono">{children}</td>;
}
function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'warning' | 'danger';
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger/30 bg-danger/5'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning/5'
        : 'border-line bg-white';
  return (
    <div className={`rounded border p-4 ${cls}`}>
      <p className="text-xs text-text-mid">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-strong">
        {value}
        {hint && <span className="ml-2 text-xs font-normal text-text-light">{hint}</span>}
      </p>
    </div>
  );
}
