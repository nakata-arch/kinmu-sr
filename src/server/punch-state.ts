import 'server-only';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { TZ } from '@/lib/datetime';
import { determineState } from '@/domain/attendance/state';
import type { AttendanceState } from '@/domain/attendance/types';

export interface TodayPunchSnapshot {
  state: AttendanceState;
  clockInAt: string | null; // formatted HH:MM in JST
  clockOutAt: string | null;
  onBreakStartedAt: string | null;
}

export async function loadTodaySnapshot(employeeId: string): Promise<TodayPunchSnapshot> {
  const supabase = createAdminClient();
  const workDate = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

  const { data: rec } = await supabase
    .from('attendance_records')
    .select('id, clock_in_at, clock_out_at')
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle();

  let openBreakRaw: string | null = null;
  if (rec) {
    const { data: openBreak } = await supabase
      .from('break_records')
      .select('started_at')
      .eq('attendance_record_id', rec.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    openBreakRaw = openBreak?.started_at ?? null;
  }

  const state = determineState({
    clockInAt: rec?.clock_in_at ? new Date(rec.clock_in_at) : null,
    clockOutAt: rec?.clock_out_at ? new Date(rec.clock_out_at) : null,
    openBreakStartedAt: openBreakRaw ? new Date(openBreakRaw) : null,
  });

  const fmt = (iso: string | null | undefined) =>
    iso ? formatInTimeZone(new Date(iso), TZ, 'HH:mm') : null;

  return {
    state,
    clockInAt: fmt(rec?.clock_in_at),
    clockOutAt: fmt(rec?.clock_out_at),
    onBreakStartedAt: fmt(openBreakRaw),
  };
}
