import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { clientEnv } from '@/lib/env';
import { EmployeeForm } from '../employee-form';
import { TokenSection } from './token-section';
import { TerminationSection } from './termination-section';

export const metadata = { title: '従業員詳細' };
export const dynamic = 'force-dynamic';

const EMPLOYMENT_LABEL: Record<string, string> = {
  regular: '正社員',
  contract: '契約社員',
  part_time: 'パート',
  arubaito: 'アルバイト',
  outsourcing: '業務委託',
};

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function EmployeeDetailPage({ params }: Props) {
  const { slug, id } = await params;
  const admin = await requireAdmin({ workplaceSlug: slug });
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  const { data: emp } = await supabase
    .from('employees')
    .select(
      'id, employee_code, last_name, first_name, last_name_kana, first_name_kana, department, position, employment_type, hired_at, terminated_at, is_active, punch_token',
    )
    .eq('id', id)
    .eq('workplace_id', workplace.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!emp) notFound();

  const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? 'https://kinmu-sr.vercel.app';
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const employeeName = `${emp.last_name} ${emp.first_name}`;
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
        <Link href={`/admin/${slug}/employees`} className="hover:underline">従業員管理</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">{employeeName}</span>
      </p>

      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">
          {employeeName}{' '}
          <span className="ml-2 font-mono text-sm font-medium text-text-mid">
            ({emp.employee_code})
          </span>
        </h1>
        <p className="mt-1 text-xs text-text-light">
          {EMPLOYMENT_LABEL[emp.employment_type] ?? emp.employment_type} ／ 入社 {emp.hired_at}
          {!emp.is_active && (
            <span className="ml-2 rounded bg-text-light/15 px-2 py-0.5 text-[10px] text-text-mid">
              退職 ({emp.terminated_at ?? '—'})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left: edit form */}
        <section className="rounded border border-line bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-text-strong">基本情報</h2>
          <EmployeeForm
            workplaceSlug={slug}
            cancelHref={`/admin/${slug}/employees`}
            employeeId={emp.id}
            employeeCode={emp.employee_code}
            lastName={emp.last_name}
            firstName={emp.first_name}
            lastNameKana={emp.last_name_kana ?? ''}
            firstNameKana={emp.first_name_kana ?? ''}
            department={emp.department ?? ''}
            position={emp.position ?? ''}
            employmentType={emp.employment_type as 'regular' | 'contract' | 'part_time' | 'arubaito' | 'outsourcing'}
            hiredAt={emp.hired_at}
          />
        </section>

        {/* Right: token + termination */}
        <section className="space-y-4">
          <TokenSection
            workplaceSlug={slug}
            employeeId={emp.id}
            punchToken={emp.punch_token}
            baseUrl={baseUrl}
          />
          <TerminationSection
            workplaceSlug={slug}
            employeeId={emp.id}
            isActive={emp.is_active}
            terminatedAt={emp.terminated_at}
            defaultDate={today}
          />
        </section>
      </div>
    </AdminShell>
  );
}
