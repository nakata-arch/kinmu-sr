import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { EditForm } from './edit-form';

export const metadata = { title: '勤怠 編集' };
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  shacho: '社労士',
  workplace_admin: '事業所管理者',
  bizpla_bpo: 'BPO',
};

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ employee?: string; date?: string }>;
}

export default async function EditAttendancePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const employeeId = sp.employee;
  const workDate = sp.date;

  if (!employeeId || !workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    redirect(`/admin/${slug}/attendance`);
  }

  const admin = await requireAdmin({ workplaceSlug: slug });
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  const { data: employee } = await supabase
    .from('employees')
    .select('id, last_name, first_name, employee_code, department')
    .eq('id', employeeId)
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (!employee) notFound();

  const { data: record } = await supabase
    .from('attendance_records')
    .select('id, clock_in_at, clock_out_at, break_minutes, absence_type, note, status')
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle();

  // History (last 5 audit entries on this record)
  let history: Array<{
    created_at: string;
    action: string;
    actor_role: string | null;
    actor_name: string | null;
    after_summary: string;
  }> = [];
  if (record) {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('id, created_at, action, actor_role, actor_id, after_value, users:actor_id(display_name)')
      .eq('resource_type', 'attendance_record')
      .eq('resource_id', record.id)
      .order('created_at', { ascending: false })
      .limit(5);
    history = (logs ?? []).map((l) => {
      const after = l.after_value as Record<string, unknown> | null;
      const summary: string[] = [];
      if (after) {
        if (after.clock_in_at) summary.push(`出勤 ${formatInTimeZone(new Date(after.clock_in_at as string), TZ, 'HH:mm')}`);
        if (after.clock_out_at) summary.push(`退勤 ${formatInTimeZone(new Date(after.clock_out_at as string), TZ, 'HH:mm')}`);
        if (after.absence_type) summary.push(`区分 ${after.absence_type}`);
        if (typeof after.break_minutes === 'number' && after.break_minutes > 0)
          summary.push(`休憩 ${after.break_minutes}分`);
      }
      return {
        created_at: l.created_at,
        action: l.action,
        actor_role: l.actor_role,
        actor_name: l.users?.display_name ?? null,
        after_summary: summary.join(' / ') || '—',
      };
    });
  }

  const fmtTime = (iso: string | null) =>
    iso ? formatInTimeZone(new Date(iso), TZ, 'HH:mm') : '';

  const dateObj = new Date(`${workDate}T00:00:00+09:00`);
  const dateLabel = `${formatInTimeZone(dateObj, TZ, 'yyyy年M月d日')}（${WEEKDAY_JA[dateObj.getDay()]}）`;

  const initialAbsence: 'none' | 'paid_leave' | 'absent' | 'special' =
    record?.absence_type === 'paid_leave'
      ? 'paid_leave'
      : record?.absence_type === 'absent'
        ? 'absent'
        : record?.absence_type === 'special'
          ? 'special'
          : 'none';

  const employeeName = `${employee.last_name} ${employee.first_name}`;
  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <AdminShell brandName={brandName} workplaceName={workplace.name} user={admin}>
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <Link href={`/admin/${slug}/attendance`} className="hover:underline">勤怠管理</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">{dateLabel}</span>
      </p>

      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">
          {dateLabel} <span className="text-base font-medium text-text-mid">— {employeeName}</span>
        </h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-text-light">
          <span className="font-mono">{employee.employee_code}</span>
          {employee.department && <span>{employee.department}</span>}
          {record && (
            <span className="rounded bg-page-bg px-2 py-0.5">
              status: {record.status}
            </span>
          )}
        </div>
      </div>

      <div className="rounded border border-line bg-white p-6">
        <EditForm
          recordId={record?.id ?? null}
          workplaceSlug={slug}
          employeeId={employee.id}
          employeeName={employeeName}
          workDate={workDate}
          initialClockIn={fmtTime(record?.clock_in_at ?? null)}
          initialClockOut={fmtTime(record?.clock_out_at ?? null)}
          initialBreakMinutes={record?.break_minutes ?? 0}
          initialAbsence={initialAbsence}
          initialNote={record?.note ?? ''}
        />
      </div>

      {/* Audit history */}
      <div className="mt-6 rounded border border-line bg-page-bg/50 p-4">
        <p className="mb-2 text-xs font-semibold text-text-mid">📝 変更履歴</p>
        {history.length === 0 ? (
          <p className="text-xs text-text-light">変更履歴はまだありません。</p>
        ) : (
          <ul className="space-y-1.5 text-xs text-text-mid">
            {history.map((h, i) => (
              <li key={i}>
                <span className="font-mono text-text-light">
                  {formatInTimeZone(new Date(h.created_at), TZ, 'yyyy-MM-dd HH:mm')}
                </span>
                {' '}
                <span className="text-text-strong">
                  {h.actor_name ?? '（不明）'}（{h.actor_role ? ROLE_LABEL[h.actor_role] ?? h.actor_role : '?'}）
                </span>
                {' が '}
                <span className="text-text-mid">{h.action === 'create' ? '新規作成' : '更新'}</span>
                <span className="ml-1 font-mono text-text-strong">{h.after_summary}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
