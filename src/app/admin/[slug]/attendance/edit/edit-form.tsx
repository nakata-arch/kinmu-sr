'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveAttendance } from './actions';

type AbsenceKind = 'none' | 'paid_leave' | 'absent' | 'special';

const ABSENCE_OPTIONS: { value: AbsenceKind; label: string }[] = [
  { value: 'none', label: '通常勤務' },
  { value: 'paid_leave', label: '有給休暇' },
  { value: 'absent', label: '欠勤' },
  { value: 'special', label: '特別休暇' },
];

interface Props {
  recordId: string | null;
  workplaceSlug: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  initialClockIn: string;
  initialClockOut: string;
  initialBreakMinutes: number;
  initialAbsence: AbsenceKind;
  initialNote: string;
}

export function EditForm(props: Props) {
  const [absence, setAbsence] = useState<AbsenceKind>(props.initialAbsence);
  const [clockIn, setClockIn] = useState(props.initialClockIn);
  const [clockOut, setClockOut] = useState(props.initialClockOut);
  const [breakMin, setBreakMin] = useState(props.initialBreakMinutes);
  const [note, setNote] = useState(props.initialNote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isAbsence = absence !== 'none';

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveAttendance({
        recordId: props.recordId,
        workplaceSlug: props.workplaceSlug,
        employeeId: props.employeeId,
        workDate: props.workDate,
        clockInTime: isAbsence ? null : clockIn || null,
        clockOutTime: isAbsence ? null : clockOut || null,
        breakMinutes: isAbsence ? 0 : Number(breakMin) || 0,
        absenceType: absence,
        note: note.trim() || null,
      });
      if ('error' in res) {
        setError(res.error);
      } else {
        router.push(`/admin/${props.workplaceSlug}/attendance`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Times */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-text-strong">時刻</h3>
          <div className="space-y-3">
            <Field label="出勤時刻">
              <input
                type="time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                disabled={isAbsence}
                className="rounded border border-line bg-white px-3 py-1.5 text-sm font-mono disabled:bg-page-bg disabled:text-text-light"
              />
            </Field>
            <Field label="退勤時刻">
              <input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                disabled={isAbsence}
                className="rounded border border-line bg-white px-3 py-1.5 text-sm font-mono disabled:bg-page-bg disabled:text-text-light"
              />
            </Field>
            <Field label="休憩時間（分）">
              <input
                type="number"
                min={0}
                max={720}
                value={isAbsence ? '' : breakMin}
                onChange={(e) => setBreakMin(Number(e.target.value))}
                disabled={isAbsence}
                className="w-32 rounded border border-line bg-white px-3 py-1.5 text-sm font-mono disabled:bg-page-bg disabled:text-text-light"
              />
            </Field>
          </div>
        </section>

        {/* Type / note */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-text-strong">区分・備考</h3>
          <div className="space-y-3">
            <Field label="勤務区分">
              <select
                value={absence}
                onChange={(e) => setAbsence(e.target.value as AbsenceKind)}
                className="rounded border border-line bg-white px-3 py-1.5 text-sm"
              >
                {ABSENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="備考" stacked>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="例：直行のため打刻忘れ、所長が代理入力"
                className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </section>
      </div>

      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href={`/admin/${props.workplaceSlug}/attendance`}
          className="rounded border border-line px-4 py-2 text-sm hover:border-text-light"
        >
          キャンセル
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-jigyosho px-4 py-2 text-sm font-semibold text-white hover:bg-jigyosho-accent disabled:opacity-50"
        >
          {pending ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  stacked,
  children,
}: {
  label: string;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={stacked ? '' : 'flex items-center gap-3'}>
      <label className={`text-xs text-text-mid ${stacked ? 'mb-1 block' : 'w-28'}`}>
        {label}
      </label>
      {children}
    </div>
  );
}
