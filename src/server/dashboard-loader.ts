import 'server-only';
import { formatInTimeZone } from 'date-fns-tz';
import { createAdminClient } from '@/lib/supabase/admin';
import { TZ } from '@/lib/datetime';

export interface WorkplaceMetric {
  id: string;
  slug: string;
  name: string;
  activeEmployees: number;
  todayPunchedIn: number;       // clocked in today (any state)
  todayCompleted: number;       // both clock_in and clock_out today
  monthRecordCount: number;     // attendance records this month
  monthFinalizedCount: number;  // those that have status='finalized'
  lastFinalizedMonth: string | null; // 'YYYY-MM' or null
  hasOpenAlerts: boolean;       // payroll_runs.summary.danger_alerts > 0 for current month
}

function monthBounds(monthYmd: string): { start: string; end: string; firstDay: string } {
  const [y, m] = monthYmd.split('-').map(Number);
  const start = `${y}-${m.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
  return { start, end, firstDay: start };
}

interface WorkplaceInput {
  id: string;
  slug: string;
  name: string;
}

/**
 * Fetch dashboard metrics for a list of workplaces in batched queries
 * (4 round-trips total regardless of workplace count). Returns a metric
 * row per workplace in the same order as the input.
 */
export async function loadDashboardMetrics(
  workplaces: WorkplaceInput[],
): Promise<WorkplaceMetric[]> {
  if (workplaces.length === 0) return [];

  const supabase = createAdminClient();
  const ids = workplaces.map((w) => w.id);
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
  const month = formatInTimeZone(new Date(), TZ, 'yyyy-MM');
  const { start: monthStart, end: monthEnd } = monthBounds(month);

  // 1. Active employees per workplace
  const { data: empRows } = await supabase
    .from('employees')
    .select('workplace_id')
    .in('workplace_id', ids)
    .eq('is_active', true)
    .is('deleted_at', null);

  // 2. Today's attendance (clocked in / completed)
  const { data: todayRows } = await supabase
    .from('attendance_records')
    .select('workplace_id, clock_in_at, clock_out_at')
    .in('workplace_id', ids)
    .eq('work_date', today);

  // 3. This month's attendance counts (status finalized vs total)
  const { data: monthRows } = await supabase
    .from('attendance_records')
    .select('workplace_id, status')
    .in('workplace_id', ids)
    .gte('work_date', monthStart)
    .lte('work_date', monthEnd);

  // 4. Latest finalized payroll_runs per workplace
  const { data: finalRuns } = await supabase
    .from('payroll_runs')
    .select('workplace_id, target_month, summary')
    .in('workplace_id', ids)
    .eq('status', 'finalized')
    .order('target_month', { ascending: false });

  // Aggregate
  const empCount = new Map<string, number>();
  for (const r of empRows ?? []) {
    empCount.set(r.workplace_id, (empCount.get(r.workplace_id) ?? 0) + 1);
  }

  const todayPunched = new Map<string, number>();
  const todayCompleted = new Map<string, number>();
  for (const r of todayRows ?? []) {
    if (r.clock_in_at) {
      todayPunched.set(r.workplace_id, (todayPunched.get(r.workplace_id) ?? 0) + 1);
      if (r.clock_out_at) {
        todayCompleted.set(r.workplace_id, (todayCompleted.get(r.workplace_id) ?? 0) + 1);
      }
    }
  }

  const monthCount = new Map<string, number>();
  const monthFinal = new Map<string, number>();
  for (const r of monthRows ?? []) {
    monthCount.set(r.workplace_id, (monthCount.get(r.workplace_id) ?? 0) + 1);
    if (r.status === 'finalized') {
      monthFinal.set(r.workplace_id, (monthFinal.get(r.workplace_id) ?? 0) + 1);
    }
  }

  // Latest finalized month per workplace, plus danger flag for current month
  const lastFinal = new Map<string, string>();
  const hasAlerts = new Map<string, boolean>();
  for (const r of finalRuns ?? []) {
    if (!lastFinal.has(r.workplace_id)) {
      lastFinal.set(r.workplace_id, r.target_month.slice(0, 7));
    }
    const targetMonth = r.target_month.slice(0, 7);
    if (targetMonth === month) {
      const summary = (r.summary ?? {}) as { danger_alerts?: number };
      if ((summary.danger_alerts ?? 0) > 0) {
        hasAlerts.set(r.workplace_id, true);
      }
    }
  }

  return workplaces.map((w) => ({
    id: w.id,
    slug: w.slug,
    name: w.name,
    activeEmployees: empCount.get(w.id) ?? 0,
    todayPunchedIn: todayPunched.get(w.id) ?? 0,
    todayCompleted: todayCompleted.get(w.id) ?? 0,
    monthRecordCount: monthCount.get(w.id) ?? 0,
    monthFinalizedCount: monthFinal.get(w.id) ?? 0,
    lastFinalizedMonth: lastFinal.get(w.id) ?? null,
    hasOpenAlerts: hasAlerts.get(w.id) ?? false,
  }));
}
