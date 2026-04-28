import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: '従業員一覧' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorkplaceListPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!workplace) notFound();

  const { data: employees } = await supabase
    .from('employees')
    .select('id, last_name, first_name, employee_code')
    .eq('workplace_id', workplace.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('employee_code', { ascending: true });

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">{workplace.name}</h1>
        <p className="text-sm text-gray-500">打刻したい人を選んでください</p>
      </div>
      <ul className="space-y-2">
        {(employees ?? []).map((e) => (
          <li key={e.id}>
            <Link
              href={`/w/${slug}/${e.id}`}
              className="block rounded border border-gray-200 px-4 py-3 text-base hover:border-gray-400 hover:bg-gray-50"
            >
              <span className="text-xs text-gray-500">{e.employee_code}</span>
              <span className="ml-3 font-medium">
                {e.last_name} {e.first_name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
