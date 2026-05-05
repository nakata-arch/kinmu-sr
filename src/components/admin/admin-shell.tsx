import Link from 'next/link';
import { LogoutButton } from '@/app/logout-button';
import type { AdminContext } from '@/lib/admin/require-admin';

const ROLE_LABEL: Record<AdminContext['role'], string> = {
  shacho: '社労士',
  workplace_admin: '事業所管理者',
  bizpla_bpo: 'BPOオペレーター',
};

const ROLE_BADGE: Record<AdminContext['role'], string> = {
  shacho: 'SHACHO',
  workplace_admin: 'WORKPLACE ADMIN',
  bizpla_bpo: 'BPO',
};

export type AdminSection = 'attendance' | 'employees' | 'settings';

const TABS: { id: AdminSection; label: string; href: (slug: string) => string }[] = [
  { id: 'attendance', label: '勤怠管理', href: (s) => `/admin/${s}/attendance` },
  { id: 'employees',  label: '従業員管理', href: (s) => `/admin/${s}/employees` },
];

export function AdminShell({
  brandName,
  workplaceName,
  workplaceSlug,
  user,
  currentSection,
  children,
}: {
  brandName: string;
  workplaceName: string;
  workplaceSlug: string;
  user: AdminContext;
  currentSection: AdminSection;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-page-bg">
      {/* Top bar */}
      <header className="bg-jigyosho text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-2">
            <Link href="/" className="text-base font-bold hover:underline">
              {brandName} 勤怠管理
            </Link>
            <span className="text-xs opacity-80">/ {workplaceName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded bg-white/15 px-2 py-1 font-mono tracking-wider">
              {ROLE_BADGE[user.role]}
            </span>
            <span>
              {user.displayName}{' '}
              <span className="opacity-70">（{ROLE_LABEL[user.role]}）</span>
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Tab nav */}
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {TABS.map((t) => {
            const active = t.id === currentSection;
            return (
              <Link
                key={t.id}
                href={t.href(workplaceSlug)}
                className={
                  active
                    ? 'border-b-2 border-white px-4 py-2 text-sm font-semibold text-white'
                    : 'border-b-2 border-transparent px-4 py-2 text-sm text-white/70 hover:text-white'
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
