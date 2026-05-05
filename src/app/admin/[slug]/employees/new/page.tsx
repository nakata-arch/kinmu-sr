import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { EmployeeForm } from '../employee-form';

export const metadata = { title: '従業員 新規追加' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NewEmployeePage({ params }: Props) {
  const { slug } = await params;
  const admin = await requireAdmin({ workplaceSlug: slug });
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  // Suggest the next employee_code based on existing rows in this workplace
  const { data: lastEmp } = await supabase
    .from('employees')
    .select('employee_code')
    .eq('workplace_id', workplace.id)
    .order('employee_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  let suggestedCode = '';
  const letter = slug.slice(-1).toUpperCase();
  if (lastEmp?.employee_code) {
    const m = lastEmp.employee_code.match(/^([A-Z]?)(\d+)$/);
    if (m) {
      const prefix = m[1] || letter;
      const next = (parseInt(m[2], 10) + 1).toString().padStart(m[2].length, '0');
      suggestedCode = `${prefix}${next}`;
    }
  }
  if (!suggestedCode) suggestedCode = `${letter}001`;

  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
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
        <span className="text-text-mid">新規追加</span>
      </p>

      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">従業員 新規追加</h1>
        <p className="mt-1 text-xs text-text-light">
          保存と同時に個人打刻URL（推測不能なトークン）が自動生成されます。
        </p>
      </div>

      <div className="rounded border border-line bg-white p-6">
        <EmployeeForm
          workplaceSlug={slug}
          cancelHref={`/admin/${slug}/employees`}
          employeeId={null}
          employeeCode={suggestedCode}
          lastName=""
          firstName=""
          lastNameKana=""
          firstNameKana=""
          department=""
          position=""
          employmentType="regular"
          hiredAt={today}
        />
      </div>
    </AdminShell>
  );
}
