import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientEnv } from '@/lib/env';

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
    <main className="min-h-svh bg-page-bg">
      {/* Brand strip */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-md px-6 py-4 text-center">
          <p className="font-mono text-[10px] tracking-[0.15em] text-shacho-accent">SHARED PC</p>
          <h1 className="mt-1 font-serif text-2xl font-bold text-shacho">{workplace.name}</h1>
          <p className="text-[11px] text-text-light">{clientEnv.NEXT_PUBLIC_BRAND_NAME} 勤怠管理</p>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-md px-6 py-8">
        <p className="mb-4 text-center text-sm text-text-mid">打刻したい人を選んでください</p>
        <ul className="space-y-2">
          {(employees ?? []).map((e) => (
            <li key={e.id}>
              <Link
                href={`/w/${slug}/${e.id}`}
                className="flex items-center justify-between rounded-lg border border-line bg-white px-5 py-4 transition hover:border-shacho hover:shadow-sm"
              >
                <div>
                  <span className="font-mono text-[11px] text-text-light">{e.employee_code}</span>
                  <span className="ml-3 text-base font-semibold text-text-strong">
                    {e.last_name} {e.first_name}
                  </span>
                </div>
                <span className="text-shacho-accent">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
