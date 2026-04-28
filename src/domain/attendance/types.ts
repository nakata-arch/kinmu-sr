export type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export type AttendanceState = 'not_started' | 'working' | 'on_break' | 'done';

export interface AttendanceSnapshot {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  openBreakStartedAt: Date | null;
}

export interface BreakInterval {
  startedAt: Date;
  endedAt: Date | null;
}
