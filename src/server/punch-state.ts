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

export interface RawSnapshot {
  clock_in_at: string | null;
  clock_out_at: string | null;
  open_break_started_at: string | null;
}

export const EMPTY_SNAPSHOT: TodayPunchSnapshot = {
  state: 'not_started',
  clockInAt: null,
  clockOutAt: null,
  onBreakStartedAt: null,
};

const fmt = (iso: string | null) =>
  iso ? formatInTimeZone(new Date(iso), TZ, 'HH:mm') : null;

export function buildSnapshot(raw: RawSnapshot): TodayPunchSnapshot {
  return {
    state: determineState({
      clockInAt: raw.clock_in_at ? new Date(raw.clock_in_at) : null,
      clockOutAt: raw.clock_out_at ? new Date(raw.clock_out_at) : null,
      openBreakStartedAt: raw.open_break_started_at
        ? new Date(raw.open_break_started_at)
        : null,
    }),
    clockInAt: fmt(raw.clock_in_at),
    clockOutAt: fmt(raw.clock_out_at),
    onBreakStartedAt: fmt(raw.open_break_started_at),
  };
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

  return buildSnapshot({
    clock_in_at: rec?.clock_in_at ?? null,
    clock_out_at: rec?.clock_out_at ?? null,
    open_break_started_at: openBreakRaw,
  });
}
