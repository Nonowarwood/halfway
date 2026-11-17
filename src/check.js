// Which online services can be reached from the viewer's network?
// Meant to be opened by Erin in China: the answer decides which free
// database halfway will use. A "no-cors" request can't read the response,
// but it fails when the connection is blocked, which is all we need.

export const CHECKS = [
  { name: 'This website', note: 'GitHub Pages', url: null },
  { name: 'Supabase', note: 'database, option 1', url: 'https://api.supabase.com/' },
  { name: 'Appwrite', note: 'database, option 2', url: 'https://cloud.appwrite.io/v1/health/version' },
  { name: 'InstantDB', note: 'database, option 3', url: 'https://api.instantdb.com/runtime/' },
  { name: 'PocketHost', note: 'database, option 4', url: 'https://pockethost.io/' },
  { name: 'Google', note: 'usually blocked in China, for comparison', url: 'https://firestore.googleapis.com/' },
];

const SLOW_MS = 3000;

async function once(url, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const t0 = performance.now();
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    return Math.round(performance.now() - t0);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Two tries, keep the fastest.
export async function probe(url, timeout = 10000) {
  const first = await once(url, timeout);
  const second = first !== null && first < 1500 ? null : await once(url, timeout);
  const times = [first, second].filter((t) => t !== null);
  if (!times.length) return { status: 'fail', ms: null };
  const ms = Math.min(...times);
  return { status: ms > SLOW_MS ? 'slow' : 'ok', ms };
}
