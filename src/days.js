import { QUESTIONS } from './questions.js';

// A "day" is a UTC date (YYYY-MM-DD), so both sides share the same question
// even with the time difference.
const DAY = 86_400_000;

export const todayKey = () => new Date().toISOString().slice(0, 10);
export const toDate = (k) => new Date(`${k}T00:00:00Z`);
export const addDays = (k, n) => new Date(toDate(k).getTime() + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
export const dayNumber = (k, start) => daysBetween(start, k) + 1;

export function questionFor(k, start) {
  const i = dayNumber(k, start) - 1;
  const n = QUESTIONS.length;
  return QUESTIONS[((i % n) + n) % n];
}

export const longDate = (k) =>
  toDate(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const shortDate = (k) =>
  toDate(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Wall-clock time somewhere else.
export function localClock(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const hour = Number(get('hour')) % 24;
  const weekday = get('weekday');
  return {
    time: `${String(hour).padStart(2, '0')}:${get('minute')}`,
    hour,
    weekend: weekday === 'Sat' || weekday === 'Sun',
  };
}

// A guess at what someone is doing, from their local time.
export function moodOf({ hour, weekend }) {
  if (hour >= 23 || hour < 7) return { icon: '💤', text: 'probably asleep' };
  if (hour < 8) return { icon: '🥱', text: 'just woke up' };
  if (!weekend && hour < 17) {
    return hour === 12 ? { icon: '🍜', text: 'lunch break' } : { icon: '📚', text: 'probably in class' };
  }
  if (hour >= 18 && hour < 20) return { icon: '🍲', text: 'dinner time' };
  return { icon: '✨', text: 'maybe free' };
}

export const msUntilNextDay = () => toDate(addDays(todayKey(), 1)) - Date.now();

export function countdown() {
  const m = Math.max(0, Math.round(msUntilNextDay() / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}
