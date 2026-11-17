import { PEOPLE } from './config.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const countWords = (s) => (String(s).trim().match(/\S+/g) || []).length;

const isWordChar = (ch) => ch !== undefined && /[\p{L}\p{N}'’-]/u.test(ch);

// Grow a selection to whole words and drop surrounding spaces.
export function snapToWords(text, start, end) {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  while (start > 0 && isWordChar(text[start - 1]) && isWordChar(text[start])) start--;
  while (end < text.length && isWordChar(text[end]) && isWordChar(text[end - 1])) end++;
  return { start, end };
}

// The sentence around a fix, cut short if it is long.
export function contextOf(text, start, end) {
  const stop = (ch) => /[.!?\n]/.test(ch);
  let s = start;
  while (s > 0 && !stop(text[s - 1])) s--;
  let e = end;
  while (e < text.length && !stop(text[e])) e++;
  if (e < text.length && text[e] !== '\n') e++;
  let before = text.slice(s, start).replace(/^\s+/, '');
  let after = text.slice(end, e).replace(/\s+$/, '');
  if (before.length > 70) before = '…' + before.slice(-70).replace(/^\S*\s/, '');
  if (after.length > 70) after = after.slice(0, 70).replace(/\s\S*$/, '') + '…';
  return { before, after };
}

export const normalize = (s) =>
  String(s).toLowerCase().replace(/’/g, "'").replace(/[.,!?;:"“”()]/g, '').replace(/\s+/g, ' ').trim();

export const fixIsValid = (text, f) => text.slice(f.start, f.end) === f.original;

// The letter's text with each fix wrapped in a <mark>, in the corrector's ink.
export function markup(text, fixes, fresh = new Set()) {
  const sorted = [...fixes].sort((a, b) => a.start - b.start);
  let out = '';
  let pos = 0;
  for (const f of sorted) {
    if (f.start < pos || !fixIsValid(text, f)) continue;
    const tone = PEOPLE[f.author]?.tone ?? 'blue';
    out += esc(text.slice(pos, f.start));
    out += `<mark class="m m-${f.status} tone-${tone}${fresh.has(f.id) ? ' fresh' : ''}" data-fix="${esc(f.id)}">${esc(f.original)}</mark>`;
    pos = f.end;
  }
  return out + esc(text.slice(pos));
}
