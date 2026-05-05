#!/usr/bin/env node
// Seed mock attendance for the last ~22 weekdays for ALL active employees,
// so the /admin/[slug]/attendance list isn't empty during the demo.
//
// Patterns mixed in:
//   - completed (~75%): clock 9:00-ish in / 18:00-19:00 out / 45m break
//   - long day (~5%): clock out 22:00+ → 長時間 alert
//   - missing clock-out (~5%): 打刻漏れ alert
//   - paid leave (~5%): absence_type=paid_leave
//   - in-progress for today's date: ~70% still on shift
//
// Idempotent: pre-fetches existing (employee, work_date) keys and skips them.
// Single batch insert for attendance + a single batch for break_records.
//
// Usage:
//   node --env-file=.env.local scripts/seed-attendance.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Deterministic PRNG so re-runs are stable (idempotency relies on existing-key check).
let _seed = 42;
function rng() {
  _seed = (_seed * 9301 + 49297) % 233280;
  return _seed / 233280;
}
function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Today (JST) in YYYY-MM-DD
function jstDateStr(d = new Date()) {
  const u = new Date(d.getTime() + 9 * 3600 * 1000);
  return u.toISOString().slice(0, 10);
}

function isoFromJST(dateStr, hhmm) {
  return new Date(`${dateStr}T${hhmm}:00+09:00`).toISOString();
}

// Build last 22 weekdays from today
const today = jstDateStr();
const dates = [];
{
  const t = new Date(`${today}T00:00:00+09:00`);
  for (let i = 0; dates.length < 22 && i < 40; i++) {
    const d = new Date(t);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    dates.push(jstDateStr(d));
  }
}
console.log(`Date range: ${dates[dates.length - 1]} → ${dates[0]} (${dates.length} weekdays)`);

console.log('Fetching employees…');
const { data: employees, error: empErr } = await supabase
  .from('employees')
  .select('id, tenant_id, workplace_id, hired_at')
  .eq('is_active', true)
  .is('deleted_at', null);
if (empErr) { console.error(empErr); process.exit(1); }
console.log(`  ${employees.length} active employees`);

console.log('Fetching existing attendance keys…');
const { data: existing } = await supabase
  .from('attendance_records')
  .select('employee_id, work_date');
const existingKeys = new Set((existing ?? []).map((e) => `${e.employee_id}:${e.work_date}`));
console.log(`  ${existingKeys.size} existing records (will be skipped)`);

const candidateAttendance = [];
const breakSpec = []; // {key, breakMinutes} — resolve to attendance_record_id after insert

for (const emp of employees) {
  for (const date of dates) {
    if (date < emp.hired_at) continue;
    const key = `${emp.id}:${date}`;
    if (existingKeys.has(key)) continue;

    const isToday = date === today;
    const r = rng();
    let pattern;
    if (isToday) {
      pattern = r < 0.7 ? 'in_progress' : r < 0.85 ? 'completed' : 'long_day';
    } else if (r < 0.05) pattern = 'paid_leave';
    else if (r < 0.10) pattern = 'missing_out';
    else if (r < 0.15) pattern = 'long_day';
    else pattern = 'completed';

    if (pattern === 'paid_leave') {
      candidateAttendance.push({
        key,
        row: {
          tenant_id: emp.tenant_id,
          workplace_id: emp.workplace_id,
          employee_id: emp.id,
          work_date: date,
          absence_type: 'paid_leave',
          break_minutes: 0,
          status: 'submitted',
        },
      });
      continue;
    }

    const clockInTime = pick(['08:55', '09:00', '09:02', '09:05', '09:08']);
    let clockOutTime = null;
    let breakMin = 0;

    if (pattern === 'in_progress') {
      clockOutTime = null;
    } else if (pattern === 'missing_out') {
      clockOutTime = null;
    } else if (pattern === 'long_day') {
      clockOutTime = pick(['21:30', '22:00', '22:45', '23:15']);
      breakMin = 60;
    } else {
      clockOutTime = pick(['17:50', '18:00', '18:15', '18:30', '19:00', '19:15']);
      breakMin = 45;
    }

    candidateAttendance.push({
      key,
      row: {
        tenant_id: emp.tenant_id,
        workplace_id: emp.workplace_id,
        employee_id: emp.id,
        work_date: date,
        clock_in_at: isoFromJST(date, clockInTime),
        clock_out_at: clockOutTime ? isoFromJST(date, clockOutTime) : null,
        break_minutes: breakMin,
        status: 'submitted',
      },
    });

    if (breakMin > 0) {
      breakSpec.push({ key, startTime: '12:00', endTime: breakMin === 60 ? '13:00' : '12:45', date });
    }
  }
}

console.log(`Will insert ${candidateAttendance.length} attendance records.`);
if (candidateAttendance.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

// Batch insert attendance, returning ids
const rowsToInsert = candidateAttendance.map((c) => c.row);
const { data: insertedAtt, error: attErr } = await supabase
  .from('attendance_records')
  .insert(rowsToInsert)
  .select('id, employee_id, work_date');
if (attErr) { console.error('attendance insert:', attErr); process.exit(1); }
console.log(`  ✓ Inserted ${insertedAtt.length} attendance records`);

const idByKey = new Map(insertedAtt.map((r) => [`${r.employee_id}:${r.work_date}`, r.id]));

// Build break_records rows
const breakRowsToInsert = [];
for (const b of breakSpec) {
  const attId = idByKey.get(b.key);
  if (!attId) continue;
  breakRowsToInsert.push({
    attendance_record_id: attId,
    started_at: isoFromJST(b.date, b.startTime),
    ended_at: isoFromJST(b.date, b.endTime),
  });
}

if (breakRowsToInsert.length) {
  const { error: brErr } = await supabase.from('break_records').insert(breakRowsToInsert);
  if (brErr) { console.error('break insert:', brErr); process.exit(1); }
  console.log(`  ✓ Inserted ${breakRowsToInsert.length} break records`);
}

console.log('\nDone. Refresh /admin/[slug]/attendance to see the data.');
