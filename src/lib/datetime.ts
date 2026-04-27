import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const TZ = 'Asia/Tokyo';

export function nowJST(): Date {
  return toZonedTime(new Date(), TZ);
}

export function toJST(date: Date | string): Date {
  return toZonedTime(typeof date === 'string' ? new Date(date) : date, TZ);
}

export function fromJST(date: Date): Date {
  return fromZonedTime(date, TZ);
}

export function formatJST(date: Date | string, fmt = 'yyyy-MM-dd HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, TZ, fmt);
}
