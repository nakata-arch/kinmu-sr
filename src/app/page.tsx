import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { TZ } from '@/lib/datetime';
import { loadDashboardMetrics, type WorkplaceMetric } from '@/server/dashboard-loader';
import { LogoutButton } from './logout-button';

const ROLE_LABEL: Record<string, string> = {
  shacho: '社労士',
  workplace_admin: '事業所管理者',
  employee: '従業員',
  bizpla_bpo: 'BPOオペレーター',
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('display_name, role, tenant_id, tenants(brand_name)')
    .eq('id', user.id)
    .single();

  const brandName = profile?.tenants?.brand_name ?? '勤怠管理システム';

  // RLS scopes this to the user's accessible workplaces
  const { data: workplaces } = await supabase
    .from('workplaces')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('name');

  const metrics = await loadDashboardMetrics(workplaces ?? []);

  const today = formatInTimeZone(new Date(), TZ, 'yyyy年M月d日');
  const month = formatInTimeZone(new Date(), TZ, 'yyyy年M月');

  // Tenant-wide aggregates (only shown for shacho/bpo)
  const isOrgWide = profile?.role === 'shacho' || profile?.role === 'bizpla_bpo';
  const totalEmployees = metrics.reduce((s, m) => s + m.activeEmployees, 0);
  const totalAlerts = metrics.filter((m) => m.hasOpenAlerts).length;

  return (
    <main className="min-h-svh bg-page-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">DASHBOARD</p>
            <h1 className="font-serif text-2xl font-bold text-shacho">{brandName}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {(profile?.role === 'shacho' || profile?.role === 'bizpla_bpo') && (
              <Link
                href="/master/users"
                className="rounded border border-line px-3 py-1.5 text-xs text-text-mid hover:border-text-light hover:text-text-strong"
              >
                ユーザー管理
              </Link>
            )}
            <div className="text-right">
              <div className="font-medium">{profile?.display_name ?? user.email}</div>
              <div className="text-xs text-text-light">
                {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : '未登録'}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Tenant-wide stats */}
        {isOrgWide && metrics.length > 0 && (
          <section className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="管轄事業所" value={`${metrics.length} 件`} />
            <Stat label="在籍従業員 合計" value={`${totalEmployees} 名`} />
            <Stat
              label="36協定 警告中"
              value={`${totalAlerts} 事業所`}
              tone={totalAlerts > 0 ? 'danger' : 'neutral'}
              hint={totalAlerts > 0 ? `${month}` : undefined}
            />
          </section>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between border-b border-line pb-2">
            <h2 className="font-serif text-xl font-bold text-shacho">事業所</h2>
            <span className="text-xs text-text-light">
              {today} 時点 — {metrics.length} 件
            </span>
          </div>

          {metrics.length === 0 ? (
            <p className="text-sm text-text-mid">事業所が登録されていません。</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {metrics.map((m) => (
                <WorkplaceCard key={m.id} m={m} canSeePayroll={isOrgWide} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function WorkplaceCard({ m, canSeePayroll }: { m: WorkplaceMetric; canSeePayroll: boolean }) {
  return (
    <li className="rounded-lg border border-line bg-white px-5 py-4 transition hover:border-shacho hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-text-strong">{m.name}</div>
          <div className="mt-0.5 font-mono text-[11px] text-text-light">/w/{m.slug}</div>
        </div>
        {m.hasOpenAlerts && (
          <span className="rounded bg-danger/15 px-2 py-0.5 text-[10px] font-semibold text-danger">
            ⚠ 36協定
          </span>
        )}
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded bg-page-bg px-3 py-2 text-center text-xs">
        <Metric label="在籍" value={`${m.activeEmployees}名`} />
        <Metric
          label="本日 出勤"
          value={`${m.todayPunchedIn}/${m.activeEmployees}`}
        />
        <Metric
          label="本日 退勤"
          value={`${m.todayCompleted}/${m.activeEmployees}`}
        />
      </div>

      <div className="mb-3 flex items-center justify-between text-[11px] text-text-mid">
        <span>
          今月の打刻: <span className="font-mono">{m.monthRecordCount}件</span>
          {m.monthFinalizedCount > 0 && (
            <span className="ml-1 text-success">（{m.monthFinalizedCount}件 確定済）</span>
          )}
        </span>
        <span>
          最終確定:{' '}
          <span className="font-mono">
            {m.lastFinalizedMonth ?? '—'}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/admin/${m.slug}/attendance`}
          className="rounded bg-jigyosho px-2 py-2 text-center text-xs font-semibold text-white hover:bg-jigyosho-accent"
        >
          勤怠管理
        </Link>
        <Link
          href={`/admin/${m.slug}/employees`}
          className="rounded border border-jigyosho px-2 py-2 text-center text-xs font-semibold text-jigyosho hover:bg-jigyosho/5"
        >
          従業員管理
        </Link>
        <Link
          href={`/w/${m.slug}`}
          className="rounded border border-line px-2 py-2 text-center text-xs font-semibold text-text-mid hover:border-text-light hover:text-text-strong"
        >
          共有PC打刻
        </Link>
      </div>
      {canSeePayroll && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            href={`/admin/${m.slug}/payroll`}
            className="rounded border border-shacho px-2 py-1.5 text-center text-[11px] font-semibold text-shacho hover:bg-shacho/5"
          >
            給与計算
          </Link>
          <Link
            href={`/admin/${m.slug}/rules`}
            className="rounded border border-line px-2 py-1.5 text-center text-[11px] font-semibold text-text-mid hover:border-text-light"
          >
            ルール設定
          </Link>
        </div>
      )}
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-light">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-text-strong">{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'danger';
}) {
  const cls =
    tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-line bg-white';
  return (
    <div className={`rounded border p-4 ${cls}`}>
      <p className="text-xs text-text-mid">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-strong">
        {value}
        {hint && <span className="ml-2 text-xs font-normal text-text-light">{hint}</span>}
      </p>
    </div>
  );
}
