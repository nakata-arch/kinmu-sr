import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { TZ } from '@/lib/datetime';
import { DEFAULT_RULES } from '@/domain/rule-engine/default-rules';
import type { CalculationRules } from '@/domain/rule-engine/types';
import { RulesForm } from './rules-form';

export const metadata = { title: 'ルール設定' };
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function RulesPage({ params }: Props) {
  const { slug } = await params;
  const admin = await requireAdmin({
    workplaceSlug: slug,
    rolesAllowed: ['shacho', 'bizpla_bpo'],
  });

  const supabase = createAdminClient();

  const { data: workplace } = await supabase
    .from('workplaces')
    .select('id, name, tenants(brand_name)')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (!workplace) notFound();

  // History (latest first)
  const { data: versions } = await supabase
    .from('calculation_rules')
    .select('id, version, effective_from, effective_until, note, created_at, users:created_by(display_name)')
    .eq('workplace_id', workplace.id)
    .order('version', { ascending: false });

  // Currently active (latest as of today)
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const { data: active } = await supabase
    .from('calculation_rules')
    .select('version, rules, effective_from')
    .eq('workplace_id', workplace.id)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeRules: CalculationRules =
    (active?.rules as CalculationRules | null) ?? DEFAULT_RULES;
  const usingDefault = !active;

  const brandName = workplace.tenants?.brand_name ?? '';

  return (
    <AdminShell
      brandName={brandName}
      workplaceName={workplace.name}
      workplaceSlug={slug}
      user={admin}
      currentSection="settings"
    >
      <p className="mb-3 text-xs text-text-light">
        <Link href="/" className="hover:underline">ダッシュボード</Link>
        <span className="mx-1">/</span>
        <span className="text-text-mid">ルール設定</span>
      </p>

      <div className="mb-5">
        <h1 className="font-serif text-2xl font-bold text-jigyosho">給与計算ルール設定</h1>
        <p className="mt-1 text-xs text-text-light">
          現在の有効バージョン:{' '}
          <span className="font-mono">v{activeRules.version}</span>
          {usingDefault && (
            <span className="ml-2 rounded bg-warning/10 px-2 py-0.5 text-warning">
              ※ デフォルトルール使用中（事業所別ルール未設定）
            </span>
          )}
        </p>
      </div>

      {/* Version history */}
      <section className="mb-6 rounded border border-line bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-text-strong">バージョン履歴</h2>
        {versions && versions.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-xs text-text-mid">
              <tr>
                <th className="text-left py-1">v</th>
                <th className="text-left py-1">適用開始</th>
                <th className="text-left py-1">適用終了</th>
                <th className="text-left py-1">作成日時</th>
                <th className="text-left py-1">作成者</th>
                <th className="text-left py-1">メモ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="py-1 font-mono">v{v.version}</td>
                  <td className="py-1 font-mono">{v.effective_from}</td>
                  <td className="py-1 font-mono text-text-light">{v.effective_until ?? '—'}</td>
                  <td className="py-1 font-mono text-xs text-text-mid">
                    {formatInTimeZone(new Date(v.created_at), TZ, 'yyyy-MM-dd HH:mm')}
                  </td>
                  <td className="py-1 text-xs">{v.users?.display_name ?? '—'}</td>
                  <td className="py-1 text-xs text-text-mid">{v.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-text-mid">
            まだバージョンが保存されていません。下のフォームから最初のルールを保存してください。
          </p>
        )}
      </section>

      {/* Editor — pre-filled with the currently active ruleset */}
      <section>
        <h2 className="mb-3 font-serif text-lg font-bold text-jigyosho">
          {versions && versions.length > 0 ? '新しいバージョンを作成' : 'ルールを設定'}
        </h2>
        <p className="mb-4 text-xs text-text-mid">
          保存すると新しいバージョン番号で記録され、適用開始日以降は新ルールが使われます。
          適用開始日より前の月の給与計算には旧バージョンのルールが使われます。
        </p>
        <RulesForm
          workplaceSlug={slug}
          defaultEffectiveFrom={today}
          initial={activeRules}
        />
      </section>
    </AdminShell>
  );
}
