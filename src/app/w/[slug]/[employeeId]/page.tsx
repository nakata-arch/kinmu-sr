import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PunchDialog } from '@/components/employee/punch-dialog';
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
    <main className="flex min-h-svh items-center justify-center bg-shacho-bg/60 px-4 py-10">
      <PunchDialog
        employeeName={employeeName}
        workplaceSlug={slug}
        employeeId={employeeId}
        snapshot={snapshot}
        initialNow={new Date().toISOString()}
      />
    </main>
  );
}
