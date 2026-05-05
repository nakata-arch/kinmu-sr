import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin/require-admin';
import { loadPayrollMonth } from '@/server/payroll-loader';
import { formatHHMM } from '@/domain/attendance/calc';

/**
 * GET /api/export/csv?slug=<workplace-slug>&month=YYYY-MM[&format=mf_cloud]
 *
 * Phase 1 ships the MFクラウド-style flat CSV (社員番号 + 氏名 + 各時間カラム).
 * Other formats (freee, yayoi) and shacho 最終確定 are Phase 2 / next sprint.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const month = url.searchParams.get('month');
  // const format = url.searchParams.get('format') ?? 'mf_cloud';

  if (!slug || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: { code: 'invalid_params', message: 'slug and month=YYYY-MM are required' } },
      { status: 400 },
    );
  }

  // Auth: shacho or bizpla_bpo only (per SPEC §6.3)
  await requireAdmin({ workplaceSlug: slug, rolesAllowed: ['shacho', 'bizpla_bpo'] });

  const result = await loadPayrollMonth({ workplaceSlug: slug, monthYmd: month });
  if (!result) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'workplace not found' } },
      { status: 404 },
    );
  }

  // Build CSV (UTF-8 BOM so Excel opens it correctly)
  const headers = [
    '対象月',
    '事業所',
    '社員番号',
    '姓',
    '名',
    '所定内',
    '法定内残業',
    '法定外残業',
    '60h超',
    '深夜',
    '法定休日',
    '所定休日',
    '有給日数',
    '欠勤日数',
    '36協定',
  ];

  const rows: string[][] = [headers];
  for (const e of result.employees) {
    const alertSeverity = e.result.alerts.find((a) => a.severity === 'danger')
      ? 'danger'
      : e.result.alerts.find((a) => a.severity === 'warning')
        ? 'warning'
        : '';
    rows.push([
      month,
      result.workplace.name,
      e.employeeCode,
      e.lastName,
      e.firstName,
      formatHHMM(e.result.regularWorkMinutes),
      formatHHMM(e.result.overtimeLegalMinutes),
      formatHHMM(e.result.overtimeStatutoryMinutes),
      formatHHMM(e.result.over60hMinutes),
      formatHHMM(e.result.nightWorkMinutes),
      formatHHMM(e.result.holidayLegalMinutes),
      formatHHMM(e.result.holidayCompanyMinutes),
      String(e.result.paidLeaveDays),
      String(e.result.absenceDays),
      alertSeverity,
    ]);
  }

  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

  const filename = `payroll_${slug}_${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function csvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
