'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { punchAction } from '@/lib/actions/punch';
import { allowedPunches } from '@/domain/attendance/state';
import type { AttendanceState, PunchType } from '@/domain/attendance/types';
import type { TodayPunchSnapshot } from '@/server/punch-state';
import { ClockDisplay } from './clock-display';

const STATE_MESSAGE: Record<AttendanceState, string> = {
  not_started: '本日まだ打刻していません',
  working: '勤務中',
  on_break: '休憩中',
  done: '本日の打刻は終了しました',
};

// JST hour-based greeting
function greetingFor(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false }).format(now),
  );
  if (hour >= 5 && hour < 11) return 'おはようございます';
  if (hour >= 11 && hour < 17) return 'こんにちは';
  return 'お疲れさまです';
}

interface Props {
  employeeName: string;
  workplaceSlug: string;
  employeeId: string;
  snapshot: TodayPunchSnapshot;
  initialNow: string; // ISO
}

export function PunchDialog({
  employeeName,
  workplaceSlug,
  employeeId,
  snapshot: initial,
  initialNow,
}: Props) {
  const [snapshot, setSnapshot] = useState<TodayPunchSnapshot>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = new Set(allowedPunches(snapshot.state));
  const greeting = greetingFor(new Date(initialNow));

  const submit = (type: PunchType) => {
    setError(null);
    const fd = new FormData();
    fd.append('type', type);
    fd.append('workplace_slug', workplaceSlug);
    fd.append('employee_id', employeeId);
    startTransition(async () => {
      const res = await punchAction(fd);
      if ('error' in res) setError(res.error);
      else setSnapshot(res.snapshot);
    });
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-line bg-white px-8 py-10 shadow-sm">
      <p className="text-center text-sm text-text-mid">{greeting}</p>
      <p className="mt-1 text-center text-2xl font-bold text-text-strong">
        {employeeName} <span className="text-base font-medium text-text-mid">さん</span>
      </p>

      <div className="my-6">
        <ClockDisplay initialNow={initialNow} />
      </div>

      <p className="text-center text-xs text-text-mid">{STATE_MESSAGE[snapshot.state]}</p>

      {(snapshot.clockInAt || snapshot.clockOutAt || snapshot.onBreakStartedAt) && (
        <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2 text-center">
          <Cell label="出勤" value={snapshot.clockInAt} />
          <Cell label="退勤" value={snapshot.clockOutAt} />
          <Cell label="休憩開始" value={snapshot.onBreakStartedAt} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <ActionBtn
          big
          variant="success"
          label="出勤"
          subLabel="CLOCK IN"
          disabled={!allowed.has('clock_in') || pending}
          onClick={() => submit('clock_in')}
        />
        <ActionBtn
          big
          variant="danger"
          label="退勤"
          subLabel="CLOCK OUT"
          disabled={!allowed.has('clock_out') || pending}
          onClick={() => submit('clock_out')}
        />
        <ActionBtn
          variant="muted"
          label="休憩 開始"
          disabled={!allowed.has('break_start') || pending}
          onClick={() => submit('break_start')}
        />
        <ActionBtn
          variant="muted"
          label="休憩 終了"
          disabled={!allowed.has('break_end') || pending}
          onClick={() => submit('break_end')}
        />
      </div>

      {error && (
        <p className="mt-4 text-center text-xs text-danger">{error}</p>
      )}

      <p className="mt-6 text-center text-xs text-text-light">
        違う方ですか？{' '}
        <Link
          href={`/w/${workplaceSlug}`}
          className="text-employee-accent hover:text-employee"
        >
          → 戻る
        </Link>
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-page-bg px-2 py-2">
      <div className="text-[10px] text-text-light">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-medium text-text-strong">{value ?? '—'}</div>
    </div>
  );
}

function ActionBtn({
  variant,
  label,
  subLabel,
  disabled,
  onClick,
  big,
}: {
  variant: 'success' | 'danger' | 'muted';
  label: string;
  subLabel?: string;
  disabled: boolean;
  onClick: () => void;
  big?: boolean;
}) {
  const sizing = big ? 'py-6 text-lg' : 'py-3 text-sm';
  const styles =
    variant === 'success'
      ? 'bg-success text-white hover:bg-success/90 disabled:bg-line disabled:text-text-light'
      : variant === 'danger'
        ? 'bg-danger text-white hover:bg-danger/90 disabled:bg-line disabled:text-text-light'
        : 'bg-text-light text-white hover:bg-text-mid disabled:bg-line disabled:text-text-light';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl font-bold transition disabled:cursor-not-allowed ${sizing} ${styles}`}
    >
      {label}
      {subLabel && <div className="mt-0.5 text-[10px] font-normal opacity-80">{subLabel}</div>}
    </button>
  );
}
