import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PunchPanel } from '@/components/employee/punch-panel';
import { loadTodaySnapshot } from '@/server/punch-state';

export const metadata = { title: '打刻' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PunchByTokenPage({ params }: Props) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: employee } = await supabase
    .from('employees')
    .select('id, last_name, first_name')
    .eq('punch_token', token)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!employee) notFound();

  const snapshot = await loadTodaySnapshot(employee.id);
  const employeeName = `${employee.last_name} ${employee.first_name}`;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <PunchPanel
        employeeName={employeeName}
        snapshot={snapshot}
        identifier={{ kind: 'token', token }}
      />
    </main>
  );
}
