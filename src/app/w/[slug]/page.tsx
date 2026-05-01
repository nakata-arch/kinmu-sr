import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClockDisplay } from '@/components/employee/clock-display';
import { TZ } from '@/lib/datetime';
import { determineState } from '@/domain/attendance/state';
import type { AttendanceState } from '@/domain/attendance/types';

export const metadata = { title: '勤怠打刻' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const STATUS_CONFIG: Record<AttendanceState, { label: string; cls: string }> = {
  not_started: { label: '未出勤', cls: 'bg-text-light/15 text-text-mid' },
  working:     { label: '勤務中', cls: 'bg-success/15 text-success' },
  on_break:    { label: '休憩中', cls: 'bg-warning/15 text-warning' },
  done:        { label: '退勤済', cls: 'bg-text-light/15 text-text-mid' },
};

export default async function WorkplaceListPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // 1. workplace + tenant brand
  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  // 2. employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, last_name, first_name, employee_code, department')
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('employee_code', { ascending: true });

  const employeeList = employees ?? [];
  const employeeIds = employeeList.map((e) => e.id);
  const workDate = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

  // 3. today's attendance for these employees
  const { data: todayAttendance } = employeeIds.length
    ? await supabase
        .from('attendance_records')
        .select('id, employee_id, clock_in_at, clock_out_at')
        .in('employee_id', employeeIds)
        .eq('work_date', workDate)
    : { data: [] as { id: string; employee_id: string; clock_in_at: string | null; clock_out_at: string | null }[] };

  const attendanceMap = new Map(
    (todayAttendance ?? []).map((a) => [a.employee_id, a]),
  );

  // 4. open breaks for those attendances
  const attendanceIds = (todayAttendance ?? []).map((a) => a.id);
  const { data: openBreaks } = attendanceIds.length
    ? await supabase
        .from('break_records')
        .select('attendance_record_id')
        .in('attendance_record_id', attendanceIds)
        .is('ended_at', null)
    : { data: [] as { attendance_record_id: string }[] };

  const onBreakAttendanceIds = new Set((openBreaks ?? []).map((b) => b.attendance_record_id));

  const stateOf = (employeeId: string): AttendanceState => {
    const a = attendanceMap.get(employeeId);
    return determineState({
      clockInAt: a?.clock_in_at ? new Date(a.clock_in_at) : null,
      clockOutAt: a?.clock_out_at ? new Date(a.clock_out_at) : null,
      openBreakStartedAt: a && onBreakAttendanceIds.has(a.id) ? new Date() : null,
    });
  };

  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <main className="min-h-svh bg-shacho-bg/60">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="text-center">
          <p className="font-mono text-[11px] tracking-[0.15em] text-shacho-accent">SHARED PC</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-shacho">
            {workplace.name} <span className="text-2xl font-medium">勤怠打刻</span>
          </h1>
          <p className="mt-1 text-xs text-text-light">{brandName} 勤怠管理</p>
        </div>

        <div className="my-10">
          <ClockDisplay initialNow={new Date().toISOString()} />
        </div>

        <p className="mb-4 text-center text-sm text-text-mid">自分の名前を選んでください</p>

        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {employeeList.map((e) => {
            const state = stateOf(e.id);
            const cfg = STATUS_CONFIG[state];
            return (
              <li key={e.id}>
                <Link
                  href={`/w/${slug}/${e.id}`}
                  className="block rounded-xl border border-line bg-white px-4 py-4 text-center transition hover:-translate-y-0.5 hover:border-employee hover:shadow-sm"
                >
                  <div className="text-base font-semibold text-text-strong">
                    {e.last_name} {e.first_name}
                  </div>
                  <div className="mt-1 text-[11px] text-text-light">
                    {e.department ?? '—'}
                  </div>
                  <span
                    className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
                  >
                    {cfg.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
