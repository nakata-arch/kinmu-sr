import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PunchPanel } from '@/components/employee/punch-panel';
import { loadTodaySnapshot } from '@/server/punch-state';

export const metadata = { title: '打刻' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string; employeeId: string }>;
}

export default async function SharedPCPunchPage({ params }: Props) {
  const { slug, employeeId } = await params;
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  const { data: employee } = await supabase
    .from('employees')
    .select('id, last_name, first_name')
    .eq('id', employeeId)
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (!employee) notFound();

  const snapshot = await loadTodaySnapshot(employee.id);
  const employeeName = `${employee.last_name} ${employee.first_name}`;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-employee-bg p-4">
      <PunchPanel
        employeeName={employeeName}
        workplaceName={workplace.name}
        snapshot={snapshot}
        identifier={{ kind: 'shared_pc', workplaceSlug: slug, employeeId }}
      />
      <Link
        href={`/w/${slug}`}
        className="text-xs text-text-mid underline-offset-2 hover:underline"
      >
        ← 一覧に戻る
      </Link>
    </main>
  );
}
