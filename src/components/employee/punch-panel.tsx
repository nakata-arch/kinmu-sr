'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { punchAction } from '@/lib/actions/punch';
import { allowedPunches } from '@/domain/attendance/state';
import type { AttendanceState, PunchType } from '@/domain/attendance/types';
import type { TodayPunchSnapshot } from '@/server/punch-state';

const LABEL: Record<PunchType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const STATE_MESSAGE: Record<AttendanceState, string> = {
  not_started: '本日まだ打刻していません',
  working: '勤務中',
  on_break: '休憩中',
  done: '本日の打刻は終了しました',
};

interface Props {
  employeeName: string;
  snapshot: TodayPunchSnapshot;
  identifier:
    | { kind: 'token'; token: string }
    | { kind: 'shared_pc'; workplaceSlug: string; employeeId: string };
}

export function PunchPanel({ employeeName, snapshot, identifier }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = new Set(allowedPunches(snapshot.state));

  const submit = (type: PunchType) => {
    setError(null);
    const fd = new FormData();
    fd.append('type', type);
    if (identifier.kind === 'token') {
      fd.append('token', identifier.token);
    } else {
      fd.append('workplace_slug', identifier.workplaceSlug);
      fd.append('employee_id', identifier.employeeId);
    }
    startTransition(async () => {
      const res = await punchAction(fd);
      if ('error' in res) setError(res.error);
    });
  };

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{employeeName}</h2>
        <p className="mt-1 text-sm text-gray-500">{STATE_MESSAGE[snapshot.state]}</p>
      </div>

      <div className="rounded border border-gray-200 px-4 py-3 text-sm">
        <Row label="出勤" value={snapshot.clockInAt} />
        <Row label="退勤" value={snapshot.clockOutAt} />
        {snapshot.onBreakStartedAt && (
          <Row label="休憩開始" value={snapshot.onBreakStartedAt} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['clock_in', 'clock_out', 'break_start', 'break_end'] as PunchType[]).map((t) => (
          <Button
            key={t}
            type="button"
            disabled={!allowed.has(t) || pending}
            onClick={() => submit(t)}
            variant={t === 'clock_in' || t === 'clock_out' ? 'default' : 'outline'}
            className="h-16 text-base"
          >
            {LABEL[t]}
          </Button>
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono">{value ?? '—'}</span>
    </div>
  );
}
