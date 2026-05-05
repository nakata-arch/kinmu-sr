import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';

export const metadata = { title: '従業員管理' };
export const dynamic = 'force-dynamic';

const EMPLOYMENT_LABEL: Record<string, string> = {
  regular: '正社員',
  contract: '契約社員',
  part_time: 'パート',
  arubaito: 'アルバイト',
  outsourcing: '業務委託',
};

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ show?: string }>;
}

export default async function EmployeesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const showInactive = sp.show === 'all';

  const admin = await requireAdmin({ workplaceSlug: slug });
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  let query = supabase
    .from('employees')
    .select(
      'id, employee_code, last_name, first_name, department, position, employment_type, hired_at, terminated_at, is_active',
    )
    .eq('workplace_id', workplace.id)
    .is('deleted_at', null)
    .order('employee_code');
  if (!showInactive) query = query.eq('is_active', true);
  const { data: employees } = await query;

  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <AdminShell
      brandName={brandName}
      workplaceName={workplace.name}
      workplaceSlug={slug}
      user={admin}
      currentSection="employees"
    >
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">従業員管理</span>
      </p>

      <div className="mb-5 flex items-end justify-between">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">
          従業員管理 <span className="text-base font-medium text-text-mid">（{workplace.name}）</span>
        </h1>
        <Link
          href={`/admin/${slug}/employees/new`}
          className="rounded bg-jigyosho px-4 py-2 text-sm font-semibold text-white hover:bg-jigyosho-accent"
        >
          ＋ 新規追加
        </Link>
      </div>

      {/* Show toggle */}
      <div className="mb-3 flex gap-2 text-xs">
        <Link
          href={`/admin/${slug}/employees`}
          className={
            !showInactive
              ? 'rounded bg-jigyosho/10 px-3 py-1 font-semibold text-jigyosho'
              : 'rounded border border-line px-3 py-1 text-text-mid hover:border-text-light'
          }
        >
          在籍のみ
        </Link>
        <Link
          href={`/admin/${slug}/employees?show=all`}
          className={
            showInactive
              ? 'rounded bg-jigyosho/10 px-3 py-1 font-semibold text-jigyosho'
              : 'rounded border border-line px-3 py-1 text-text-mid hover:border-text-light'
          }
        >
          退職者を含む
        </Link>
      </div>

      <div className="overflow-hidden rounded border border-line bg-white">
        {employees && employees.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-page-bg text-xs text-text-mid">
              <tr>
                <Th>社員番号</Th>
                <Th>氏名</Th>
                <Th>部署 / 役職</Th>
                <Th>雇用区分</Th>
                <Th>入社日</Th>
                <Th>状態</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.map((e) => (
                <tr key={e.id} className={!e.is_active ? 'bg-page-bg text-text-light' : ''}>
                  <td className="px-3 py-2 font-mono text-xs">{e.employee_code}</td>
                  <td className="px-3 py-2 font-medium">
                    {e.last_name} {e.first_name}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e.department ?? '—'}
                    {e.position ? <span className="text-text-light"> / {e.position}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {EMPLOYMENT_LABEL[e.employment_type] ?? e.employment_type}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.hired_at}</td>
                  <td className="px-3 py-2">
                    {e.is_active ? (
                      <span className="rounded bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                        在籍
                      </span>
                    ) : (
                      <span className="rounded bg-text-light/15 px-2 py-0.5 text-[10px] font-semibold text-text-mid">
                        退職 ({e.terminated_at ?? '—'})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/${slug}/employees/${e.id}`}
                      className="rounded border border-line bg-white px-2 py-1 text-[11px] text-jigyosho hover:border-jigyosho hover:bg-jigyosho/5"
                    >
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-text-mid">
            従業員が登録されていません。
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
