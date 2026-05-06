'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createManagementUser, updateManagementUser } from './actions';

type Role = 'shacho' | 'workplace_admin' | 'bizpla_bpo';

const ROLE_OPTIONS: { value: Role; label: string; help: string }[] = [
  { value: 'shacho',          label: '社労士',          help: '事務所内のすべての事業所を横断アクセス、最終確定可' },
  { value: 'workplace_admin', label: '事業所管理者',     help: '指定した1事業所の勤怠を管理' },
  { value: 'bizpla_bpo',      label: 'BPOオペレーター', help: '社労士相当の横断アクセス、最終確定だけは不可' },
];

export interface UserFormInitial {
  userId: string | null;       // null → create
  email: string;
  displayName: string;
  role: Role;
  workplaceId: string | null;
  isActive: boolean;
}

interface Props extends UserFormInitial {
  workplaces: { id: string; name: string }[];
  cancelHref: string;
  /** Disable certain destructive controls when editing self */
  isSelf: boolean;
}

export function UserForm(props: Props) {
  const isCreate = props.userId === null;
  const [email, setEmail] = useState(props.email);
  const [password, setPassword] = useState(''); // create only required, edit optional
  const [displayName, setDisplayName] = useState(props.displayName);
  const [role, setRole] = useState<Role>(props.role);
  const [workplaceId, setWorkplaceId] = useState(props.workplaceId ?? '');
  const [isActive, setIsActive] = useState(props.isActive);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      if (isCreate) {
        const res = await createManagementUser({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          role,
          workplaceId: role === 'workplace_admin' ? workplaceId || null : null,
        });
        if ('error' in res) setError(res.error);
        else router.push('/master/users');
      } else {
        const res = await updateManagementUser({
          userId: props.userId!,
          displayName: displayName.trim(),
          role,
          workplaceId: role === 'workplace_admin' ? workplaceId || null : null,
          isActive,
          newPassword: password.trim() ? password : null,
        });
        if ('error' in res) setError(res.error);
        else router.push('/master/users');
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="メールアドレス" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isCreate}
            className={`w-full rounded border border-line bg-white px-3 py-1.5 text-sm font-mono ${!isCreate ? 'bg-page-bg text-text-mid' : ''}`}
          />
          {!isCreate && (
            <p className="mt-1 text-[11px] text-text-light">編集ではメール変更はできません</p>
          )}
        </Field>

        <Field label="表示名" required>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Field>

        <Field label={isCreate ? 'パスワード' : '新パスワード（任意）'} required={isCreate}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={isCreate ? 8 : 0}
            placeholder={isCreate ? '8文字以上' : '空欄なら変更しない'}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm font-mono"
          />
        </Field>

        {!isCreate && (
          <Field label="状態">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                disabled={props.isSelf}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              有効（チェックを外すとログインできなくなります）
            </label>
            {props.isSelf && (
              <p className="mt-1 text-[11px] text-text-light">自分自身は無効化できません</p>
            )}
          </Field>
        )}
      </div>

      <Field label="ロール" required stacked>
        <div className="space-y-2">
          {ROLE_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-start gap-2 rounded border border-line bg-white px-3 py-2 has-[:checked]:border-jigyosho has-[:checked]:bg-jigyosho/5">
              <input
                type="radio"
                name="role"
                value={o.value}
                checked={role === o.value}
                disabled={props.isSelf}
                onChange={() => setRole(o.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold">{o.label}</div>
                <div className="text-[11px] text-text-mid">{o.help}</div>
              </div>
            </label>
          ))}
        </div>
        {props.isSelf && (
          <p className="mt-1 text-[11px] text-text-light">自分自身のロールは変更できません</p>
        )}
      </Field>

      {role === 'workplace_admin' && (
        <Field label="所属事業所" required>
          <select
            value={workplaceId}
            onChange={(e) => setWorkplaceId(e.target.value)}
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          >
            <option value="">— 選択してください —</option>
            {props.workplaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </Field>
      )}

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
          {pending ? '保存中…' : isCreate ? '作成' : '保存'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  stacked,
  children,
}: {
  label: string;
  required?: boolean;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={stacked ? '' : ''}>
      <label className="mb-1 block text-xs text-text-mid">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
