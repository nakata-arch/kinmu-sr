'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveRules } from './actions';
import type { CalculationRules, DayOfWeek } from '@/domain/rule-engine/types';

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'mon', label: '月' },
  { value: 'tue', label: '火' },
  { value: 'wed', label: '水' },
  { value: 'thu', label: '木' },
  { value: 'fri', label: '金' },
  { value: 'sat', label: '土' },
  { value: 'sun', label: '日' },
];

const OT_DEFINITIONS: { value: 'beyond_scheduled' | 'beyond_legal'; label: string }[] = [
  { value: 'beyond_legal', label: '法定 (8h/日) を超えた分' },
  { value: 'beyond_scheduled', label: '所定時間を超えた分（参考）' },
];

interface Props {
  workplaceSlug: string;
  defaultEffectiveFrom: string; // YYYY-MM-DD
  initial: CalculationRules;
}

export function RulesForm({ workplaceSlug, defaultEffectiveFrom, initial }: Props) {
  const [effectiveFrom, setEffectiveFrom] = useState(defaultEffectiveFrom);
  const [note, setNote] = useState('');

  // basic
  const [scheduledHours, setScheduledHours] = useState(initial.basic.scheduledWorkMinutesPerDay / 60);
  const [scheduledStart, setScheduledStart] = useState(initial.basic.scheduledStartTime);
  const [scheduledEnd, setScheduledEnd] = useState(initial.basic.scheduledEndTime);
  const [breakMinutes, setBreakMinutes] = useState(initial.basic.breakMinutes);
  const [weeklyHolidays, setWeeklyHolidays] = useState<DayOfWeek[]>(initial.basic.weeklyHolidays);

  // overtime
  const [otDefinition, setOtDefinition] = useState(initial.overtime.definition);
  const [fixedOtHours, setFixedOtHours] = useState(initial.overtime.fixedOvertimeMinutes / 60);
  const [nightStart, setNightStart] = useState(initial.overtime.nightStartTime);
  const [nightEnd, setNightEnd] = useState(initial.overtime.nightEndTime);
  const [over60h, setOver60h] = useState(initial.overtime.over60hEnabled);

  // holiday
  const [legalHoliday, setLegalHoliday] = useState<DayOfWeek>(initial.holiday.legalHoliday);
  const [companyHolidays, setCompanyHolidays] = useState<DayOfWeek[]>(initial.holiday.companyHolidays);
  const [customHolidaysText, setCustomHolidaysText] = useState(initial.holiday.customHolidays.join('\n'));

  // allowance
  const [weekdayOtRate, setWeekdayOtRate] = useState(initial.allowance.weekdayOvertimeRate * 100);
  const [nightOtRate, setNightOtRate] = useState(initial.allowance.nightOvertimeRate * 100);
  const [legalHolidayRate, setLegalHolidayRate] = useState(initial.allowance.legalHolidayRate * 100);
  const [companyHolidayRate, setCompanyHolidayRate] = useState(initial.allowance.companyHolidayRate * 100);
  const [over60hRate, setOver60hRate] = useState(initial.allowance.over60hRate * 100);

  // 36協定
  const [monthlyLimitHours, setMonthlyLimitHours] = useState(initial.agreement36.monthlyLimitMinutes / 60);
  const [yearlyLimitHours, setYearlyLimitHours] = useState(initial.agreement36.yearlyLimitMinutes / 60);
  const [warnPercent, setWarnPercent] = useState(initial.agreement36.warningThresholdPercent * 100);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = () => {
    setError(null);
    const customDates = customHolidaysText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

    startTransition(async () => {
      const res = await saveRules({
        workplaceSlug,
        effectiveFrom,
        note: note.trim() || null,
        rules: {
          basic: {
            scheduledWorkMinutesPerDay: Math.round(scheduledHours * 60),
            scheduledStartTime: scheduledStart,
            scheduledEndTime: scheduledEnd,
            breakMinutes,
            weeklyHolidays,
          },
          overtime: {
            definition: otDefinition,
            fixedOvertimeMinutes: Math.round(fixedOtHours * 60),
            nightStartTime: nightStart,
            nightEndTime: nightEnd,
            over60hEnabled: over60h,
          },
          holiday: {
            legalHoliday,
            companyHolidays,
            customHolidays: customDates,
          },
          allowance: {
            weekdayOvertimeRate: weekdayOtRate / 100,
            nightOvertimeRate: nightOtRate / 100,
            legalHolidayRate: legalHolidayRate / 100,
            companyHolidayRate: companyHolidayRate / 100,
            over60hRate: over60hRate / 100,
          },
          agreement36: {
            monthlyLimitMinutes: Math.round(monthlyLimitHours * 60),
            yearlyLimitMinutes: Math.round(yearlyLimitHours * 60),
            warningThresholdPercent: warnPercent / 100,
          },
        },
      });
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };

  const toggleArr = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-6">
      <Section title="基本設定">
        <Row label="所定労働時間 (時/日)">
          <NumberInput value={scheduledHours} step={0.25} onChange={setScheduledHours} />
        </Row>
        <Row label="始業 / 終業">
          <input type="time" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className={timeCls} />
          <span className="mx-1 text-text-light">–</span>
          <input type="time" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className={timeCls} />
        </Row>
        <Row label="標準休憩 (分)">
          <NumberInput value={breakMinutes} step={5} onChange={setBreakMinutes} />
        </Row>
        <Row label="週休（曜日）">
          <DayPicker selected={weeklyHolidays} onChange={(d) => setWeeklyHolidays(toggleArr(weeklyHolidays, d))} />
        </Row>
      </Section>

      <Section title="残業設定">
        <Row label="残業定義">
          <select value={otDefinition} onChange={(e) => setOtDefinition(e.target.value as 'beyond_scheduled' | 'beyond_legal')} className={selectCls}>
            {OT_DEFINITIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Row>
        <Row label="みなし残業 (時/月)">
          <NumberInput value={fixedOtHours} step={1} onChange={setFixedOtHours} />
        </Row>
        <Row label="深夜時間帯">
          <input type="time" value={nightStart} onChange={(e) => setNightStart(e.target.value)} className={timeCls} />
          <span className="mx-1 text-text-light">–</span>
          <input type="time" value={nightEnd} onChange={(e) => setNightEnd(e.target.value)} className={timeCls} />
          <span className="ml-2 text-[11px] text-text-light">(終了が開始以下なら翌日扱い)</span>
        </Row>
        <Row label="60h超 残業を区分">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={over60h} onChange={(e) => setOver60h(e.target.checked)} />
            有効
          </label>
        </Row>
      </Section>

      <Section title="休日設定">
        <Row label="法定休日（曜日）">
          <select value={legalHoliday} onChange={(e) => setLegalHoliday(e.target.value as DayOfWeek)} className={selectCls}>
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}曜日</option>
            ))}
          </select>
        </Row>
        <Row label="所定休日（複数）">
          <DayPicker selected={companyHolidays} onChange={(d) => setCompanyHolidays(toggleArr(companyHolidays, d))} />
        </Row>
        <Row label="特定休日 (1行1日付)" stacked>
          <textarea
            value={customHolidaysText}
            onChange={(e) => setCustomHolidaysText(e.target.value)}
            rows={4}
            placeholder="2026-12-29&#10;2026-12-30&#10;2026-12-31"
            className="w-full rounded border border-line bg-white px-3 py-2 font-mono text-sm"
          />
          <p className="mt-1 text-[11px] text-text-light">YYYY-MM-DD 形式以外の行は無視されます。</p>
        </Row>
      </Section>

      <Section title="割増率（％）">
        <Row label="平日法定外残業">
          <NumberInput value={weekdayOtRate} step={5} onChange={setWeekdayOtRate} suffix="%" />
        </Row>
        <Row label="深夜">
          <NumberInput value={nightOtRate} step={5} onChange={setNightOtRate} suffix="%" />
        </Row>
        <Row label="法定休日">
          <NumberInput value={legalHolidayRate} step={5} onChange={setLegalHolidayRate} suffix="%" />
        </Row>
        <Row label="所定休日">
          <NumberInput value={companyHolidayRate} step={5} onChange={setCompanyHolidayRate} suffix="%" />
        </Row>
        <Row label="60h超">
          <NumberInput value={over60hRate} step={5} onChange={setOver60hRate} suffix="%" />
        </Row>
      </Section>

      <Section title="36協定">
        <Row label="月の上限 (時間)">
          <NumberInput value={monthlyLimitHours} step={5} onChange={setMonthlyLimitHours} />
        </Row>
        <Row label="年の上限 (時間)">
          <NumberInput value={yearlyLimitHours} step={10} onChange={setYearlyLimitHours} />
        </Row>
        <Row label="警告閾値 (％の到達時)">
          <NumberInput value={warnPercent} step={5} onChange={setWarnPercent} suffix="%" />
        </Row>
      </Section>

      <Section title="保存設定">
        <Row label="適用開始日">
          <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className={timeCls} />
        </Row>
        <Row label="メモ" stacked>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="例: 2026年4月から所定時間を変更"
            className="w-full rounded border border-line bg-white px-3 py-1.5 text-sm"
          />
        </Row>
      </Section>

      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-jigyosho px-5 py-2 text-sm font-semibold text-white hover:bg-jigyosho-accent disabled:opacity-50"
        >
          {pending ? '保存中…' : '新しいバージョンとして保存'}
        </button>
      </div>
    </div>
  );
}

const timeCls = 'rounded border border-line bg-white px-2 py-1 text-sm font-mono';
const selectCls = 'rounded border border-line bg-white px-3 py-1.5 text-sm';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-line bg-white p-5">
      <h3 className="mb-4 border-b border-line pb-2 text-sm font-semibold text-text-strong">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  stacked,
  children,
}: {
  label: string;
  stacked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={stacked ? '' : 'flex flex-wrap items-center gap-3'}>
      <label className={`text-xs text-text-mid ${stacked ? 'mb-1 block' : 'w-44'}`}>{label}</label>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  step,
  onChange,
  suffix,
}: {
  value: number;
  step: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded border border-line bg-white px-2 py-1 text-sm font-mono text-right"
      />
      {suffix && <span className="text-xs text-text-mid">{suffix}</span>}
    </span>
  );
}

function DayPicker({
  selected,
  onChange,
}: {
  selected: DayOfWeek[];
  onChange: (d: DayOfWeek) => void;
}) {
  return (
    <div className="flex gap-1">
      {DAYS.map((d) => {
        const on = selected.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onChange(d.value)}
            className={
              on
                ? 'h-8 w-9 rounded bg-jigyosho text-sm font-bold text-white'
                : 'h-8 w-9 rounded border border-line bg-white text-sm text-text-mid hover:border-jigyosho'
            }
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
