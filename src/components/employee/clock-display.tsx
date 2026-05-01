'use client';

import { useEffect, useState } from 'react';

const fmtTime = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const fmtDate = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

export function ClockDisplay({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <div className="font-mono text-5xl font-medium tracking-tight text-text-strong tabular-nums">
        {fmtTime.format(now)}
      </div>
      <div className="mt-1 text-xs text-text-mid">{fmtDate.format(now)}</div>
    </div>
  );
}
