import type { AttendanceSnapshot, AttendanceState, PunchType } from './types';

export function determineState(snapshot: AttendanceSnapshot): AttendanceState {
  if (snapshot.clockInAt === null) return 'not_started';
  if (snapshot.clockOutAt !== null) return 'done';
  if (snapshot.openBreakStartedAt !== null) return 'on_break';
  return 'working';
}

export function allowedPunches(state: AttendanceState): readonly PunchType[] {
  switch (state) {
    case 'not_started':
      return ['clock_in'];
    case 'working':
      return ['clock_out', 'break_start'];
    case 'on_break':
      return ['break_end'];
    case 'done':
      return [];
  }
}

export function isPunchAllowed(state: AttendanceState, type: PunchType): boolean {
  return allowedPunches(state).includes(type);
}
