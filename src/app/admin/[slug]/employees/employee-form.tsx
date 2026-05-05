'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveEmployee } from './actions';

type EmploymentType = 'regular' | 'contract' | 'part_time' | 'arubaito' | 'outsourcing';

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'regular', label: '正社員' },
  { value: 'contract', label: '契約社員' },
  { value: 'part_time', label: 'パート' },
  { value: 'arubaito', label: 'アルバイト' },
  { value: 'outsourcing', label: '業務委託' },
];

export interface EmployeeFormInitial {
  employeeId: string | null;
  employeeCode: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  department: string;
  position: string;
  employmentType: EmploymentType;
  hiredAt: string;
}

interface Props extends EmployeeFormInitial {
  workplaceSlug: string;
  cancelHref: string;
}

export function EmployeeForm(props: Props) {
  const [employeeCode, setEmployeeCode] = useState(props.employeeCode);
  const [lastName, setLastName] = useState(props.lastName);
  const [firstName, setFirstName] = useState(props.firstName);
  const [lastNameKana, setLastNameKana] = useState(props.lastNameKana);
  const [firstNameKana, setFirstNameKana] = useState(props.firstNameKana);
  const [department, setDepartment] = useState(props.department);
  const [position, setPosition] = useState(props.position);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(props.employmentType);
  const [hiredAt, setHiredAt] = useState(props.hiredAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveEmployee({
        workplaceSlug: props.workplaceSlug,
        employeeId: props.employeeId,
        employeeCode: employeeCode.trim(),
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        lastNameKana: lastNameKana.trim() || null,
        firstNameKana: firstNameKana.trim() || null,
        department: department.trim() || null,
        position: position.trim() || null,
        employmentType,
        hiredAt,
      });
      if ('error' in res) {
        setError(res.error);
      } else {
        router.push(`/admin/${props.workplaceSlug}/employees/${res.employeeId}`);
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="社員番号" required>
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            maxLength={20}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm font-mono"
          />
        </Field>
        <Field label="入社日" required>
          <input
            type="date"
            value={hiredAt}
            onChange={(e) => setHiredAt(e.target.value)}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm font-mono"
          />
        </Field>
        <Field label="姓" required>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={40}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="名" required>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={40}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="セイ（カナ）">
          <input
            value={lastNameKana}
            onChange={(e) => setLastNameKana(e.target.value)}
            maxLength={60}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="メイ（カナ）">
          <input
            value={firstNameKana}
            onChange={(e) => setFirstNameKana(e.target.value)}
            maxLength={60}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="部署">
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={60}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="役職">
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            maxLength={60}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="雇用区分" required>
          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          >
            {EMPLOYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href={props.cancelHref}
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
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-text-mid">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
