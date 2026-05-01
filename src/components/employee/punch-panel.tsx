'use client';

import { useState, useTransition } from 'react';
import { punchAction } from '@/lib/actions/punch';
import { allowedPunches } from '@/domain/attendance/state';
import type { AttendanceState, PunchType } from '@/domain/attendance/types';
import type { TodayPunchSnapshot } from '@/server/punch-state';

const STATE_MESSAGE: Record<AttendanceState, string> = {
  not_started: '本日まだ打刻していません',
  working: '勤務中',
  on_break: '休憩中',
  done: '本日の打刻は終了しました',
};

interface Props {
  employeeName: string;
  workplaceName?: string;
  snapshot: TodayPunchSnapshot;
  identifier:
    | { kind: 'token'; token: string }
    | { kind: 'shared_pc'; workplaceSlug: string; employeeId: string };
}

export function PunchPanel({ employeeName, workplaceName, snapshot: initial, identifier }: Props) {
  const [snapshot, setSnapshot] = useState<TodayPunchSnapshot>(initial);
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
      if ('error' in res) {
        setError(res.error);
      } else {
        setSnapshot(res.snapshot);
      }
    });
  };

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      {/* Header (employee gradient) */}
      <div className="bg-gradient-to-b from-employee to-employee-accent px-5 py-4 text-white">
        <p className="text-[11px] opacity-85">本日の打刻</p>
        <p className="mt-0.5 text-lg font-bold">{employeeName}</p>
        {workplaceName && <p className="text-[11px] opacity-80">{workplaceName}</p>}
      </div>

      {/* State */}
      <div className="border-b border-line bg-employee-bg/40 px-5 py-3 text-center">
        <p className="text-xs text-text-mid">{STATE_MESSAGE[snapshot.state]}</p>
      </div>

      {/* Status rows */}
      <div className="divide-y divide-line px-5 text-sm">
        <Row label="出勤" value={snapshot.clockInAt} />
        <Row label="退勤" value={snapshot.clockOutAt} />
        {snapshot.onBreakStartedAt && <Row label="休憩開始" value={snapshot.onBreakStartedAt} />}
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-2 p-4">
        <PunchButton
          label="出勤"
          variant="success"
          disabled={!allowed.has('clock_in') || pending}
          onClick={() => submit('clock_in')}
        />
        <PunchButton
          label="退勤"
          variant="danger"
          disabled={!allowed.has('clock_out') || pending}
          onClick={() => submit('clock_out')}
        />
        <PunchButton
          label="休憩開始"
          variant="muted"
          disabled={!allowed.has('break_start') || pending}
          onClick={() => submit('break_start')}
        />
        <PunchButton
          label="休憩終了"
          variant="muted"
          disabled={!allowed.has('break_end') || pending}
          onClick={() => submit('break_end')}
        />
      </div>

      {error && (
        <div className="border-t border-line bg-danger/5 px-4 py-3 text-center text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-text-mid">{label}</span>
      <span className="font-mono text-base text-text-strong">{value ?? '—'}</span>
    </div>
  );
}

function PunchButton({
  label,
  variant,
  disabled,
  onClick,
}: {
  label: string;
  variant: 'success' | 'danger' | 'muted';
  disabled: boolean;
  onClick: () => void;
}) {
  const base = 'h-16 rounded-lg text-base font-semibold transition disabled:cursor-not-allowed';
  const styles =
    variant === 'success'
      ? 'bg-success text-white hover:bg-success/90 disabled:bg-line disabled:text-text-light'
      : variant === 'danger'
        ? 'bg-danger text-white hover:bg-danger/90 disabled:bg-line disabled:text-text-light'
        : 'bg-text-light/15 text-text-mid hover:bg-text-light/25 disabled:bg-line disabled:text-text-light';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${styles}`}>
      {label}
    </button>
  );
}
