import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import {
  actualWorkMinutes,
  overtimeMinutes,
  formatHHMM,
  deriveRowStatus,
  rowNeedsAttention,
  type RowStatus,
} from '@/domain/attendance/calc';

export const metadata = { title: '勤怠一覧' };
export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<RowStatus, { label: string; cls: string }> = {
  in_progress:    { label: '勤務中',   cls: 'bg-employee/15 text-employee-accent' },
  completed:      { label: '完了',     cls: 'bg-success/15 text-success' },
  alert_missing:  { label: '要確認',   cls: 'bg-danger/15 text-danger' },
  alert_long:     { label: '長時間',   cls: 'bg-warning/15 text-warning' },
  absence_paid:   { label: '有給',     cls: 'bg-shacho/10 text-shacho' },
  absence:        { label: '欠勤',     cls: 'bg-text-light/15 text-text-mid' },
  absence_other:  { label: '休',       cls: 'bg-text-light/15 text-text-mid' },
};

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

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

function monthBounds(value: string): { start: string; end: string; label: string } {
  const [yStr, mStr] = value.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = `${yStr}-${mStr.padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // 0th of next month = last of this
  const end = `${yStr}-${mStr.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { start, end, label: `${y}年${m}月` };
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string; employee?: string; status?: string }>;
}

export default async function AdminAttendancePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const user = await requireAdmin({ workplaceSlug: slug });

  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  const sp = await searchParams;
  const months = recentMonths(6);
  const monthValue = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0].value;
  const { start, end, label: monthLabel } = monthBounds(monthValue);
  const employeeFilter = sp.employee || '';
  const statusFilter = sp.status || '';

  const { data: employees } = await supabase
    .from('employees')
    .select('id, last_name, first_name, employee_code')
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('employee_code');

  // Attendance records for the month
  let q = supabase
    .from('attendance_records')
    .select(
      'id, employee_id, work_date, clock_in_at, clock_out_at, break_minutes, absence_type, status, note',
    )
    .eq('workplace_id', workplace.id)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: false })
    .order('employee_id');
  if (employeeFilter) q = q.eq('employee_id', employeeFilter);
  const { data: records } = await q;

  const empById = new Map(
    (employees ?? []).map((e) => [e.id, e] as const),
  );

  type DisplayRow = {
    id: string;
    employeeId: string;
    workDateRaw: string;
    employeeCode: string;
    employeeName: string;
    workDate: string;
    weekday: string;
    inAtFmt: string;
    outAtFmt: string;
    breakFmt: string;
    workFmt: string;
    overtimeFmt: string;
    status: RowStatus;
  };

  let rows: DisplayRow[] = (records ?? []).map((r) => {
    const emp = empById.get(r.employee_id);
    const inAt = r.clock_in_at ? new Date(r.clock_in_at) : null;
    const outAt = r.clock_out_at ? new Date(r.clock_out_at) : null;
    const work = actualWorkMinutes(inAt, outAt, r.break_minutes);
    const ot = overtimeMinutes(work);
    const status = deriveRowStatus(
      { clockInAt: inAt, clockOutAt: outAt, absenceType: r.absence_type },
      work,
    );
    const dateObj = new Date(`${r.work_date}T00:00:00+09:00`);
    return {
      id: r.id,
      employeeId: r.employee_id,
      workDateRaw: r.work_date,
      employeeCode: emp?.employee_code ?? '—',
      employeeName: emp ? `${emp.last_name} ${emp.first_name}` : '（不明）',
      workDate: formatInTimeZone(dateObj, TZ, 'MM/dd'),
      weekday: WEEKDAY_JA[dateObj.getDay()],
      inAtFmt: inAt ? formatInTimeZone(inAt, TZ, 'HH:mm') : '—',
      outAtFmt: outAt ? formatInTimeZone(outAt, TZ, 'HH:mm') : '—',
      breakFmt: r.break_minutes ? `${r.break_minutes}分` : '—',
      workFmt: formatHHMM(work),
      overtimeFmt: formatHHMM(ot),
      status,
    };
  });

  if (statusFilter === 'alert') rows = rows.filter((r) => rowNeedsAttention(r.status));
  else if (statusFilter === 'in_progress') rows = rows.filter((r) => r.status === 'in_progress');
  else if (statusFilter === 'completed') rows = rows.filter((r) => r.status === 'completed');
  else if (statusFilter === 'absence')
    rows = rows.filter((r) => r.status.startsWith('absence'));

  const alertCount = (records ?? []).filter((r) => {
    const inAt = r.clock_in_at ? new Date(r.clock_in_at) : null;
    const outAt = r.clock_out_at ? new Date(r.clock_out_at) : null;
    const work = actualWorkMinutes(inAt, outAt, r.break_minutes);
    const status = deriveRowStatus(
      { clockInAt: inAt, clockOutAt: outAt, absenceType: r.absence_type },
      work,
    );
    return rowNeedsAttention(status);
  }).length;

  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <AdminShell brandName={brandName} workplaceName={workplace.name} user={user}>
      {/* Breadcrumb */}
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">勤怠管理 / {monthLabel}</span>
      </p>

      {/* Title */}
      <div className="mb-5 flex items-end justify-between">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">
          勤怠一覧 <span className="text-base font-medium text-text-mid">{monthLabel}</span>
        </h1>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            className="cursor-not-allowed rounded border border-line bg-white px-3 py-1.5 text-text-light"
            title="Sprint 4で実装予定"
          >
            CSV出力
          </button>
          <button
            type="button"
            className="cursor-not-allowed rounded border border-line bg-white px-3 py-1.5 text-text-light"
            title="Sprint 4で実装予定"
          >
            月次締め
          </button>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-3 rounded border border-line bg-white px-4 py-3">
        <Field label="期間">
          <select name="month" defaultValue={monthValue} className="rounded border border-line bg-white px-2 py-1 text-sm">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="従業員">
          <select name="employee" defaultValue={employeeFilter} className="rounded border border-line bg-white px-2 py-1 text-sm">
            <option value="">すべて</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.employee_code} {e.last_name} {e.first_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="状態">
          <select name="status" defaultValue={statusFilter} className="rounded border border-line bg-white px-2 py-1 text-sm">
            <option value="">すべて</option>
            <option value="alert">要確認のみ</option>
            <option value="in_progress">勤務中</option>
            <option value="completed">完了</option>
            <option value="absence">欠勤・有給</option>
          </select>
        </Field>
        <button type="submit" className="rounded bg-jigyosho px-3 py-1.5 text-xs font-semibold text-white hover:bg-jigyosho-accent">
          適用
        </button>
        <div className="ml-auto text-xs text-text-mid">
          <span className={alertCount > 0 ? 'font-semibold text-danger' : 'text-text-light'}>
            ● 要確認 {alertCount}件
          </span>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded border border-line bg-white">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-text-mid">{monthLabel}の勤怠記録はまだありません。</p>
            <p className="mt-1 text-xs text-text-light">
              <Link href={`/w/${slug}`} className="text-jigyosho hover:underline">
                /w/{slug}
              </Link>{' '}
              から打刻すると一覧に表示されます。
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-page-bg text-xs text-text-mid">
              <tr>
                <Th>氏名</Th>
                <Th>日付</Th>
                <Th>出勤</Th>
                <Th>退勤</Th>
                <Th>休憩</Th>
                <Th>実働</Th>
                <Th>残業</Th>
                <Th>状態</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const badge = STATUS_BADGE[r.status];
                const rowCls =
                  r.status === 'alert_missing'
                    ? 'bg-danger/[0.03]'
                    : r.status === 'alert_long'
                      ? 'bg-warning/[0.05]'
                      : '';
                return (
                  <tr key={r.id} className={rowCls}>
                    <td className="px-3 py-2">
                      <span className="text-[10px] text-text-light mr-1.5 font-mono">{r.employeeCode}</span>
                      <span className="font-medium">{r.employeeName}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-text-mid">
                      {r.workDate} <span className="text-text-light">({r.weekday})</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{r.inAtFmt}</td>
                    <td className="px-3 py-2 font-mono">{r.outAtFmt}</td>
                    <td className="px-3 py-2 font-mono text-text-mid">{r.breakFmt}</td>
                    <td className="px-3 py-2 font-mono">{r.workFmt}</td>
                    <td className="px-3 py-2 font-mono">{r.overtimeFmt}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/${slug}/attendance/edit?employee=${r.employeeId}&date=${r.workDateRaw}`}
                        className="rounded border border-line bg-white px-2 py-1 text-[11px] text-jigyosho hover:border-jigyosho hover:bg-jigyosho/5"
                      >
                        修正
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-[11px] text-text-light">
        ※ 各行の「修正」ボタン (日次詳細・編集) は Sprint 3-2 で実装予定。
        CSV出力・月次締めは Sprint 4 で実装予定。
      </p>
    </AdminShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-text-mid">{label}</span>
      {children}
    </label>
  );
}
