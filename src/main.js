import '@fontsource/gaegu/latin-400.css';
import '@fontsource/gaegu/latin-700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/600.css';
import './style.css';

import { PEOPLE, IDS, START_DATE, MIN_WORDS } from './config.js';
import { store } from './store/index.js';
import {
  todayKey, addDays, daysBetween, dayNumber, questionFor, longDate, shortDate,
  localClock, moodOf, countdown, msUntilNextDay,
} from './days.js';
import { esc, countWords, snapToWords, contextOf, normalize, fixIsValid, markup } from './text.js';
import { plantState, plantSVG } from './plant.js';
import { buildDemo } from './demo.js';
import { CHECKS, probe } from './check.js';

const app = document.getElementById('app');
const dev = document.getElementById('dev');
const fab = document.getElementById('fix-fab');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Per-device things (drafts, quiz scores, which letters you've opened).
const local = {
  get(k, fallback = null) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ }
  },
  del(k) {
    try { localStorage.removeItem(k); } catch { /* private mode */ }
  },
};

const state = {
  me: whoAmI(),
  data: { answers: [], corrections: [], meta: {} },
  today: todayKey(),
  editing: new Set(),
  fixDraft: null,
  notebookTab: 'mine',
  quiz: null,
  check: null,
  focusAfter: null,
  // one-shot animation flags, cleared after each render
  entering: true,
  fresh: new Set(),
  justSent: null,
  justOpened: null,
  bump: false,
  deal: false,
};

function whoAmI() {
  const fromUrl = new URLSearchParams(location.search).get('as');
  if (IDS.includes(fromUrl)) return fromUrl;
  const saved = local.get('halfway:me');
  return IDS.includes(saved) ? saved : IDS[0];
}

// ---------- data helpers ----------

const other = () => IDS.find((id) => id !== state.me);
const P = (id) => PEOPLE[id];
const nameOf = (id) => esc(PEOPLE[id].name);
const startDate = () => state.data.meta?.start || START_DATE;
const answerOf = (date, who) => state.data.answers.find((a) => a.date === date && a.author === who);
const answerById = (id) => state.data.answers.find((a) => a.id === id);
const fixesOn = (a) => (a ? state.data.corrections.filter((c) => c.answerId === a.id) : []);
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function togetherDates() {
  const them = other();
  const dates = state.data.answers
    .filter((a) => a.author === state.me && answerOf(a.date, them))
    .map((a) => a.date);
  return [...new Set(dates)].sort();
}

const draftKey = (date) => `halfway:draft:${state.me}:${date}`;
const seenKey = (id = state.me) => `halfway:seen:${id}`;
const isSeen = (date) => local.get(seenKey(), []).includes(date);
function markSeen(date) {
  const seen = local.get(seenKey(), []);
  if (!seen.includes(date)) local.set(seenKey(), [...seen, date].slice(-400));
}

function clearDeviceState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('halfway:') && k !== 'halfway:db' && k !== 'halfway:me')
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* private mode */ }
  state.quiz = null;
  state.editing.clear();
}

// ---------- motion helpers ----------

let animating = false;

// Add a class, wait for its animation, then carry on.
function play(el, cls, ms) {
  if (!el || calm) return Promise.resolve();
  animating = true;
  el.classList.add(cls);
  return new Promise((resolve) => setTimeout(() => {
    animating = false;
    resolve();
  }, ms));
}

const COLORS = ['var(--blue)', 'var(--rose)', 'var(--sun)', 'var(--blue-ink)', 'var(--rose-ink)'];

function confetti(x, y, count = 22) {
  if (calm) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 90;
    bit.style.setProperty('--x', `${(Math.cos(angle) * dist).toFixed(0)}px`);
    bit.style.setProperty('--y', `${(Math.sin(angle) * dist - 40).toFixed(0)}px`);
    bit.style.setProperty('--r', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    bit.style.background = COLORS[i % COLORS.length];
    if (i % 4 === 0) bit.style.borderRadius = '50%';
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1400);
}

const PLANE_SVG = `<svg viewBox="0 0 48 40" aria-hidden="true">
  <path d="M3 19 45 3 30 37 22 25Z" style="fill:var(--sheet);stroke:var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M45 3 22 25l-2 10 7-7" style="fill:var(--t);stroke:var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>
</svg>`;

// A paper plane flies from one element towards another.
function flyPlane(fromEl, toEl, tone) {
  if (calm || !fromEl) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl?.getBoundingClientRect();
  const x0 = a.left + a.width / 2;
  const y0 = a.top + a.height / 2;
  const x1 = b ? b.left + b.width / 2 : innerWidth - 40;
  const y1 = b ? b.top + Math.min(b.height / 2, 120) : 30;
  const plane = document.createElement('div');
  plane.className = `plane-fly tone-${tone}`;
  plane.innerHTML = PLANE_SVG;
  plane.style.left = `${x0}px`;
  plane.style.top = `${y0}px`;
  plane.style.setProperty('--dx', `${(x1 - x0).toFixed(0)}px`);
  plane.style.setProperty('--dy', `${(y1 - y0).toFixed(0)}px`);
  document.body.appendChild(plane);
  setTimeout(() => plane.remove(), 1300);
}

// ---------- routing ----------

function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  if (page === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '')) {
    let date = arg;
    if (date > state.today) date = state.today;
    if (date < startDate()) date = startDate();
    return { page: 'day', date };
  }
  if (['days', 'notebook', 'quiz', 'check'].includes(page)) return { page };
  return { page: 'day', date: state.today };
}

// ---------- render ----------

let pending = false;
let enterTimer = 0;

function render() {
  pending = false;
  const r = route();
  const entering = state.entering && !calm;
  state.entering = false;
  dev.innerHTML = r.page === 'check' ? '' : devBar();
  let view;
  if (r.page === 'check') view = checkView();
  else if (state.today < startDate()) view = notStarted();
  else if (r.page === 'day') view = dayView(r.date);
  else if (r.page === 'days') view = daysView();
  else if (r.page === 'notebook') view = notebookView();
  else view = quizView();
  clearTimeout(enterTimer);
  app.classList.toggle('entering', entering);
  // Arrival animations are done after ~2.5 s; drop the class so they can't
  // interfere with the animations of what you do next.
  if (entering) enterTimer = setTimeout(() => app.classList.remove('entering'), 2600);
  app.innerHTML = `${header(r)}<main class="main">${view}</main>${modal()}`;
  afterRender(r);
  state.fresh.clear();
  state.justSent = null;
  state.justOpened = null;
  state.bump = false;
  state.deal = false;
  if (state.quiz) state.quiz.anim = null;
}

function afterRender(r) {
  app.querySelectorAll('textarea.ruled').forEach(grow);
  if (state.fixDraft?.focus) {
    state.fixDraft.focus = false;
    const input = app.querySelector('[name=suggestion]');
    input?.focus();
    input?.select();
  }
  if (state.focusAfter) {
    app.querySelector(state.focusAfter)?.focus({ preventScroll: true });
    state.focusAfter = null;
  }
  const opened = app.querySelector('.just-opened');
  if (opened) {
    const box = opened.getBoundingClientRect();
    confetti(box.left + box.width / 2, box.top + 40, 28);
  }
  if (r.page === 'day' && r.date === state.today) maybeWater();
  if (r.page === 'check' && !state.check) runCheck();
  const score = app.querySelector('[data-count]');
  if (score) countUp(score);
}

function grow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}

// The plant gets watered once, the first time you see both of today's letters.
function maybeWater() {
  const t = state.today;
  if (!answerOf(t, state.me) || !answerOf(t, other())) return;
  const key = `halfway:watered:${state.me}`;
  if (local.get(key) === t) return;
  local.set(key, t);
  const plant = app.querySelector('.plant');
  if (!plant || calm) return;
  plant.classList.add('watering');
  setTimeout(() => plant.classList.remove('watering'), 2800);
}

function countUp(el) {
  const target = Number(el.dataset.count);
  const total = el.dataset.total;
  if (calm) {
    el.textContent = `${target} / ${total}`;
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700);
    el.textContent = `${Math.round(target * (1 - (1 - k) ** 3))} / ${total}`;
    if (k < 1) requestAnimationFrame(step);
    else if (target === Number(total)) {
      const b = el.getBoundingClientRect();
      confetti(b.left + b.width / 2, b.top + b.height / 2, 36);
    }
  };
  requestAnimationFrame(step);
}

const busy = () => {
  const el = document.activeElement;
  return animating || !!state.fixDraft || (!!el && app.contains(el) && el.matches('textarea, input'));
};

// Re-render for changes that come from elsewhere, without wiping what you're typing.
function softRender() {
  if (busy()) pending = true;
  else render();
}

async function refresh() {
  state.data = await store.load();
  render();
}

// ---------- header ----------

function mountLogo() {
  const ROUTE = 'M15 7Q66-3 117 7';
  const BACK = 'M117 7Q66-3 15 7';
  const [a, b] = IDS.map((id) => P(id).tone);
  const plane = (path, tone, begin) => (calm ? '' : `<g class="tone-${tone}" opacity="0">
      <path d="M-6-4 6 0-6 4-3.5 0Z" style="fill:var(--t-ink)"/>
      <animateMotion dur="10s" begin="${begin}s" repeatCount="indefinite" rotate="auto" path="${path}" keyPoints="0;1;1" keyTimes="0;.42;1" calcMode="linear"/>
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.04;.38;.42;1" dur="10s" begin="${begin}s" repeatCount="indefinite"/>
    </g>`);
  document.querySelector('.logo').innerHTML = `<span class="logo-word">halfway</span>
    <svg class="logo-route" viewBox="0 0 132 12" aria-hidden="true">
      <path class="logo-dash" d="${ROUTE}" fill="none" style="stroke:var(--ink-2)" stroke-width="1.6" stroke-dasharray="3 5" stroke-linecap="round"/>
      <circle cx="6" cy="7" r="4.5" class="tone-${a}" style="fill:var(--t)"/>
      <circle cx="126" cy="7" r="4.5" class="tone-${b}" style="fill:var(--t)"/>
      ${plane(ROUTE, a, 0.8)}${plane(BACK, b, 5.8)}
    </svg>`;
}

const timeHTML = (t) => t.replace(':', '<span class="colon">:</span>');
const moodHTML = (m) => `<span class="mood-icon" aria-hidden="true">${m.icon}</span><span class="mood-text"> ${m.text}</span>`;

function header(r) {
  const tab = (href, label, on, extra = '') =>
    `<a href="${href}" class="tab${on ? ' is-on' : ''}${extra}"${on ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<div class="top">
    <div class="clocks">${[state.me, other()].map(clockChip).join('')}</div>
    <nav class="tabs" aria-label="Sections">
      ${tab('#/', 'Today', r.page === 'day' && r.date === state.today)}
      ${tab('#/days', 'Days', r.page === 'days' || (r.page === 'day' && r.date !== state.today))}
      ${tab('#/notebook', 'Notebook', r.page === 'notebook', state.bump ? ' bump' : '')}
      ${tab('#/quiz', 'Quiz', r.page === 'quiz')}
    </nav>
  </div>`;
}

function clockChip(id) {
  const p = P(id);
  const c = localClock(p.tz);
  const m = moodOf(c);
  const mine = id === state.me;
  return `<div class="clock tone-${p.tone}">
    <span aria-hidden="true">${p.flag}</span>
    <span class="clock-time" data-clock="${id}">${timeHTML(c.time)}</span>
    <span class="clock-who">${mine ? 'you' : esc(p.name)}</span>
    ${mine ? '' : `<span class="clock-mood" data-mood="${id}" title="${esc(m.text)}">${moodHTML(m)}</span>`}
  </div>`;
}

function devBar() {
  if (store.kind !== 'local') return '';
  const chips = IDS.map((id) =>
    `<button type="button" class="chip${id === state.me ? ' is-on' : ''}" data-action="be" data-id="${id}" aria-pressed="${id === state.me}">${nameOf(id)}</button>`,
  ).join('');
  return `<div class="devbar" role="region" aria-label="Preview mode">
    <span>Preview: letters are saved in this browser only.</span>
    <span class="devbar-group">Viewing as ${chips}</span>
    <button type="button" class="chip" data-action="demo">Fill with example letters</button>
    <button type="button" class="chip" data-action="wipe">Start empty</button>
    <a class="chip" href="#/check">Connection check</a>
  </div>`;
}

// ---------- day ----------

const notStarted = () =>
  `<section class="prompt"><h1 class="prompt-q">The first question arrives on ${longDate(startDate())}.</h1></section>`;

// Each word gets its own span so the question can be "written" word by word.
const handwritten = (s) => esc(s).split(' ').map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');

function dayView(date) {
  const n = dayNumber(date, startDate());
  const q = questionFor(date, startDate());
  const mine = answerOf(date, state.me);
  const theirs = answerOf(date, other());
  const isToday = date === state.today;
  return `${isToday ? inbox() : '<a class="back" href="#/">Back to today</a>'}
    <section class="prompt">
      <p class="prompt-day">Day ${n}, ${longDate(date)}</p>
      <h1 class="prompt-q">${handwritten(q.q)}</h1>
      ${q.tip ? `<p class="prompt-tip"><span aria-hidden="true">💡</span> ${esc(q.tip)}</p>` : ''}
    </section>
    <section class="desks">
      ${myLetter(date, mine, theirs)}
      <div class="halfway">${isToday ? plantFigure() : dayStamp(mine, theirs)}</div>
      ${theirLetter(date, mine, theirs, isToday)}
    </section>
    ${isToday ? nextNote() : ''}`;
}

function inbox() {
  const me = state.me;
  const them = other();
  const past = (a) => a.author === them && a.date !== state.today;
  const waiting = state.data.corrections.filter((c) => c.target === me && c.status === 'pending' && c.date !== state.today);
  const owed = state.data.answers.filter((a) => past(a) && !answerOf(a.date, me)).map((a) => a.date).sort();
  const unopened = state.data.answers.filter((a) => past(a) && answerOf(a.date, me) && !isSeen(a.date)).map((a) => a.date).sort();
  const items = [];
  if (unopened.length) {
    items.push(`<a href="#/day/${unopened[0]}">${plural(unopened.length, 'letter')} from ${nameOf(them)} to open</a>`);
  }
  if (waiting.length) {
    const first = waiting.map((c) => c.date).sort()[0];
    items.push(`<a href="#/day/${first}">${plural(waiting.length, 'fix', 'fixes')} from ${nameOf(them)} to look at</a>`);
  }
  if (owed.length) {
    items.push(`<a href="#/day/${owed[0]}">${nameOf(them)} wrote on day ${dayNumber(owed[0], startDate())}, your letter is missing</a>`);
  }
  if (!items.length) return '';
  return `<aside class="inbox" aria-label="Waiting for you">${items.map((it, i) => it.replace('<a ', `<a style="--i:${i}" `)).join('')}</aside>`;
}

const wordsLabel = (w) => (w < MIN_WORDS ? `${plural(w, 'word')}, ${MIN_WORDS} needed to send` : plural(w, 'word'));

function myLetter(date, mine, theirs) {
  const p = P(state.me);
  const both = mine && theirs;
  const writing = !mine || (!both && state.editing.has(date));
  let body;
  if (writing) {
    const draft = local.get(draftKey(date)) ?? mine?.text ?? '';
    const w = countWords(draft);
    body = `<form class="compose" data-form="answer" data-date="${date}">
      <label class="sr-only" for="ta-${date}">Your letter</label>
      <textarea id="ta-${date}" class="ruled" data-draft="${date}" placeholder="Write in English. No translator: the mistakes are the point.">${esc(draft)}</textarea>
      <div class="compose-foot">
        <span class="wc" data-wc>${wordsLabel(w)}</span>
        ${mine ? `<button type="button" class="btn btn-quiet" data-action="cancel-edit" data-date="${date}">Cancel</button>` : ''}
        <button type="submit" class="btn btn-ink" data-send${w < MIN_WORDS ? ' disabled' : ''}>${mine ? 'Save changes' : 'Send letter'}</button>
      </div>
    </form>`;
  } else if (!both) {
    body = `<div class="answer-text ruled">${esc(mine.text)}</div>
      <div class="letter-foot">
        <p class="note">Sent. ${nameOf(other())} can read it once they've sent theirs.</p>
        <button type="button" class="btn btn-quiet" data-action="edit" data-date="${date}">Edit</button>
      </div>`;
  } else {
    const fixes = fixesOn(mine);
    body = `<div class="answer-text ruled">${markup(mine.text, fixes, state.fresh)}</div>${fixList(fixes, 'received')}`;
  }
  const posted = mine && !writing
    ? `<div class="posted" aria-hidden="true"><span>Sent</span><span>${shortDate(mine.createdAt.slice(0, 10))}</span></div>`
    : '';
  const sent = state.justSent === date ? ' just-sent' : '';
  return `<article class="letter mine tone-${p.tone}${sent}" aria-label="Your letter">${posted}
    <header class="letter-head"><span class="who">${esc(p.name)}</span><span class="who-sub">you</span></header>
    ${body}
  </article>`;
}

function theirLetter(date, mine, theirs, isToday) {
  const p = P(other());
  const head = `<header class="letter-head"><span class="who">${esc(p.name)}</span></header>`;
  if (!theirs) {
    let icon = '✉️';
    let msg = `<p>No letter from ${esc(p.name)} this day.</p>`;
    if (isToday) {
      const c = localClock(p.tz);
      const m = moodOf(c);
      icon = m.icon;
      msg = `<p>${esc(p.name)} hasn't written yet.</p><p class="note">It's ${c.time} for them, ${m.text}.</p>`;
    }
    return `<article class="letter theirs letter-empty tone-${p.tone}" aria-label="${esc(p.name)}'s letter">${head}
      <div class="empty"><p class="empty-icon" aria-hidden="true">${icon}</p>${msg}</div></article>`;
  }
  if (!mine) return envelope(p, date, 'locked');
  if (!isSeen(date)) return envelope(p, date, 'ready');
  const fixes = fixesOn(theirs);
  const opening = state.justOpened === date ? ' just-opened' : '';
  return `<article class="letter theirs tone-${p.tone}${opening}" aria-label="${esc(p.name)}'s letter">${head}
    <div class="answer-text ruled" data-correctable data-answer="${esc(theirs.id)}" data-date="${date}">${markup(theirs.text, fixes, state.fresh)}</div>
    <p class="note hint">Something sounds off? Select the words to suggest a fix.</p>
    ${fixList(fixes, 'given')}
  </article>`;
}

function envelope(p, date, mode) {
  const ready = mode === 'ready';
  const fresh = ready && state.justSent === date ? ' unlocked' : '';
  return `<article class="letter theirs envelope ${mode}${fresh} tone-${p.tone}" aria-label="${ready ? 'Letter' : 'Sealed letter'} from ${esc(p.name)}">
    <div class="env-body">
      <div class="env">
        <svg class="env-flap" viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H100L50 42Z"/></svg>
        <div class="stamp" aria-hidden="true">${p.flag}</div>
        <div class="postmark" aria-hidden="true"><span>${esc(p.place)}</span><span>${shortDate(date)}</span></div>
        <p class="env-to">To ${esc(P(state.me).name)}</p>
        ${ready
    ? `<p class="env-msg">${esc(p.name)}'s letter is here.</p>
           <button type="button" class="btn btn-ink env-open" data-action="open" data-date="${date}">Open the letter</button>`
    : `<p class="env-msg">${esc(p.name)}'s letter is here. Send yours to open it.</p>`}
      </div>
    </div>
  </article>`;
}

const btn = (action, id, label, kind = 'btn-line') =>
  `<button type="button" class="btn btn-small ${kind}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;

function fixList(fixes, side) {
  const shown = fixes
    .filter((c) => fixIsValid(answerById(c.answerId)?.text ?? '', c))
    .sort((a, b) => a.start - b.start);
  if (!shown.length) return '';
  const title = side === 'received' ? `Fixes from ${nameOf(other())}` : 'Your fixes';
  return `<section class="fixes"><h2 class="fixes-title">${title}</h2><ul>${shown.map((c, i) => fixItem(c, side, i)).join('')}</ul></section>`;
}

function fixItem(c, side, i) {
  const them = nameOf(other());
  let status = '';
  let actions = '';
  if (side === 'received') {
    if (c.status === 'pending') actions = btn('accept', c.id, 'Got it', 'btn-ink') + btn('dispute', c.id, "I'm not convinced");
    else if (c.status === 'accepted') status = 'Saved in your notebook';
    else {
      status = "You weren't convinced. Look it up together.";
      actions = btn('accept', c.id, 'Actually, got it');
    }
  } else if (c.status === 'pending') {
    status = `Waiting for ${them}`;
    actions = btn('delete-fix', c.id, 'Remove');
  } else if (c.status === 'accepted') status = `${them} got it`;
  else status = `${them} isn't convinced. Look it up together.`;

  const fresh = state.fresh.has(c.id) ? ' fresh' : '';
  return `<li class="fix fix-${c.status} tone-${P(c.author).tone}${fresh}" id="fix-${esc(c.id)}" style="--i:${i}">
    <p class="fix-line"><del>${esc(c.original)}</del> <ins class="pen">${esc(c.suggestion)}</ins>${c.unsure ? ' <span class="unsure">🤔 not sure</span>' : ''}</p>
    ${c.why ? `<p class="fix-why">${esc(c.why)}</p>` : ''}
    <div class="fix-foot">${status ? `<span class="fix-status">${status}</span>` : ''}${actions}</div>
  </li>`;
}

function plantFigure() {
  const { count, mood } = plantState(togetherDates(), state.today);
  const days = plural(count, 'day');
  const caption = {
    seed: 'A seed between your two letters. It sprouts the first day you both write.',
    happy: `${days} written together. Watered today.`,
    ok: `${days} together. It needs both letters today.`,
    thirsty: 'Thirsty. Write today to perk it up.',
    wilted: 'It misses you both. One day of letters brings it back.',
  }[mood];
  const label = `Your plant: ${days} together, ${mood === 'happy' ? 'watered today' : mood === 'seed' ? 'not sprouted yet' : 'waiting for water'}`;
  return `<figure class="plant plant-${mood}">
    ${plantSVG(count, mood, [P(state.me).tone, P(other()).tone], label)}
    <figcaption>${caption}</figcaption>
  </figure>`;
}

const dayStamp = (mine, theirs) => {
  if (mine && theirs) return '<p class="stamp-note"><span aria-hidden="true">🌱</span> You both wrote this day.</p>';
  return `<p class="stamp-note">${!mine && !theirs ? 'No letters this day.' : 'Only one letter this day.'}</p>`;
};

function nextNote() {
  const next = new Date(Date.now() + msUntilNextDay());
  const at = (id) => localClock(P(id).tz, next).time;
  return `<p class="next">Next question in <span data-countdown>${countdown()}</span>: ${at(state.me)} for you, ${at(other())} for ${nameOf(other())}.</p>`;
}

function modal() {
  const d = state.fixDraft;
  if (!d) return '';
  return `<div class="overlay" data-overlay>
    <form class="sheet tone-${P(state.me).tone}" data-form="fix" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <h2 id="sheet-title" class="sheet-title">Suggest a fix</h2>
      <p class="sheet-orig">${esc(d.before)}<del>${esc(d.original)}</del>${esc(d.after)}</p>
      <label class="field"><span>Better</span><input name="suggestion" value="${esc(d.original)}" autocomplete="off" autocapitalize="off"></label>
      <label class="field"><span>Why? One line, optional</span><input name="why" autocomplete="off" placeholder="e.g. 'homework' has no plural"></label>
      <label class="check"><input type="checkbox" name="unsure"> I'm not 100% sure about this one</label>
      <p class="sheet-err" data-err role="alert"></p>
      <div class="sheet-foot">
        <button type="button" class="btn btn-quiet" data-action="close-fix">Cancel</button>
        <button type="submit" class="btn btn-ink">Send fix</button>
      </div>
    </form>
  </div>`;
}

// ---------- days ----------

const dot = (id, has) =>
  `<span class="dot tone-${P(id).tone}${has ? ' is-on' : ''}" title="${nameOf(id)}: ${has ? 'wrote' : 'no letter'}"><span class="sr-only">${nameOf(id)} ${has ? 'wrote' : 'did not write'}</span></span>`;

function daysView() {
  const s = startDate();
  const me = state.me;
  const them = other();
  const total = daysBetween(s, state.today) + 1;
  const rows = [];
  for (let k = state.today; k >= s; k = addDays(k, -1)) {
    const mine = answerOf(k, me);
    const theirs = answerOf(k, them);
    rows.push(`<li style="--i:${Math.min(rows.length, 14)}"><a class="day-row" href="#/day/${k}">
      <span class="day-n">Day ${dayNumber(k, s)}</span>
      <span class="day-q">${esc(questionFor(k, s).q)}</span>
      <span class="day-who">${dot(me, mine)}${dot(them, theirs)}${mine && theirs ? '<span class="day-sprout" aria-hidden="true">🌱</span>' : ''}</span>
    </a></li>`);
  }
  return `<section class="page-head"><h1 class="page-title">Days</h1>
    <p class="page-lede">You both wrote on ${plural(togetherDates().length, 'day')} out of ${total}. Open any day to read it again or catch up.</p></section>
    <ol class="day-list">${rows.join('')}</ol>`;
}

// ---------- notebook ----------

const you = (id) => (id === state.me ? 'You' : nameOf(id));
const was = (id) => (id === state.me ? 'were' : 'was');

// A stable little tilt per sticky note.
function tilt(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 5) - 2) * 0.8;
}

function notebookView() {
  const me = state.me;
  const them = other();
  const all = state.data.corrections;
  const lists = {
    mine: all.filter((c) => c.status === 'accepted' && c.target === me),
    theirs: all.filter((c) => c.status === 'accepted' && c.target === them),
    check: all.filter((c) => c.status === 'disputed' || (c.unsure && c.status === 'accepted')),
  };
  const labels = { mine: 'My mistakes', theirs: `${nameOf(them)}'s mistakes`, check: 'To double-check' };
  const tab = lists[state.notebookTab] ? state.notebookTab : 'mine';
  const items = [...lists[tab]].sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? 1 : -1));
  const empty = {
    mine: `Nothing yet. When ${nameOf(them)} fixes one of your sentences and you tap "Got it", it lands here.`,
    theirs: `Nothing yet. The fixes you send to ${nameOf(them)} land here once they accept them.`,
    check: "Nothing to check. Fixes someone wasn't sure about, or didn't agree with, show up here.",
  }[tab];
  const tabs = Object.keys(lists).map((k) =>
    `<button type="button" role="tab" aria-selected="${k === tab}" data-action="nb-tab" data-tab="${k}">${labels[k]} <span class="seg-n">${lists[k].length}</span></button>`,
  ).join('');
  return `<section class="page-head"><h1 class="page-title">Notebook</h1>
      <p class="page-lede">Every fix you accept is kept here. The quiz brings them back until they stick.</p></section>
    <div class="seg" role="tablist" aria-label="Notebook pages">${tabs}</div>
    ${tab === 'check' && items.length ? '<p class="note check-note">Neither of you is a native speaker, so these deserve a second opinion: a teacher, a good dictionary, or a quick search.</p>' : ''}
    ${items.length ? `<ul class="cards${state.deal ? ' deal' : ''}">${items.map(noteCard).join('')}</ul>` : `<p class="empty-line">${empty}</p>`}`;
}

function noteCard(c, i) {
  const a = answerById(c.answerId);
  if (!a || !fixIsValid(a.text, c)) return '';
  const { before, after } = contextOf(a.text, c.start, c.end);
  let flag = '';
  if (c.status === 'disputed') flag = `${you(c.target)} ${was(c.target)}n't convinced.`;
  else if (c.unsure) flag = `${you(c.author)} ${was(c.author)}n't sure about this one.`;
  return `<li class="note-card tone-${P(c.author).tone}" style="--i:${Math.min(i, 12)};--tilt:${tilt(c.id)}deg">
    <a class="note-day" href="#/day/${c.date}">Day ${dayNumber(c.date, startDate())}</a>
    <p class="note-ctx">${esc(before)}<del>${esc(c.original)}</del>${esc(after)}</p>
    <p class="pen note-fix">${esc(c.suggestion)}</p>
    ${c.why ? `<p class="fix-why">${esc(c.why)}</p>` : ''}
    ${flag ? `<p class="fix-status">🤔 ${flag}</p>` : ''}
  </li>`;
}

// ---------- quiz ----------

const quizKey = () => `halfway:quiz:${state.me}`;

function quizSource(set) {
  return state.data.corrections.filter((c) =>
    c.status === 'accepted'
    && (set === 'all' || c.target === state.me)
    && fixIsValid(answerById(c.answerId)?.text ?? '', c));
}

// Cards you got wrong most come first. Ten per round.
function startQuiz(set) {
  const scores = local.get(quizKey(), {});
  const deck = quizSource(set)
    .map((c) => ({ id: c.id, rank: (scores[c.id]?.ok ?? 0) - (scores[c.id]?.ko ?? 0) + Math.random() * 0.9 }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((x) => x.id);
  state.quiz = { set, deck, i: 0, revealed: false, attempt: '', right: 0, anim: 'in' };
}

function quizView() {
  const head = `<section class="page-head"><h1 class="page-title">Quiz</h1>
    <p class="page-lede">Your old mistakes come back as cards. Try to fix them before you peek.</p></section>`;
  const q = state.quiz;
  if (!q) {
    const mine = quizSource('mine').length;
    const all = quizSource('all').length;
    if (!all) return `${head}<p class="empty-line">No cards yet. They come from the notebook: accept a few fixes first.</p>`;
    return `${head}<div class="quiz-start">
      <button type="button" class="btn btn-ink" data-action="quiz-start" data-set="mine"${mine ? '' : ' disabled'}>My mistakes (${mine})</button>
      <button type="button" class="btn btn-line" data-action="quiz-start" data-set="all">Both of ours (${all})</button>
    </div>`;
  }
  if (q.i >= q.deck.length) {
    const perfect = q.right === q.deck.length;
    return `${head}<div class="flash flash-done card-in">
      <p class="flash-score" data-count="${q.right}" data-total="${q.deck.length}">0 / ${q.deck.length}</p>
      <p>${perfect ? 'All of them. Your past self would be proud.' : 'The ones you missed come back first next time.'}</p>
      <div class="flash-foot">
        <button type="button" class="btn btn-line" data-action="quiz-exit">Done</button>
        <button type="button" class="btn btn-ink" data-action="quiz-start" data-set="${q.set}">Practise again</button>
      </div>
    </div>`;
  }
  const c = state.data.corrections.find((x) => x.id === q.deck[q.i]);
  const a = c && answerById(c.answerId);
  if (!a) {
    q.i += 1;
    return quizView();
  }
  const { before, after } = contextOf(a.text, c.start, c.end);
  const whose = c.target === state.me ? 'your' : `${nameOf(c.target)}'s`;
  let body;
  if (!q.revealed) {
    body = `<label class="field"><span>How would you fix the highlighted part?</span>
        <input name="attempt" autocomplete="off" autocapitalize="off" placeholder="Type your version, or just think it"></label>
      <div class="flash-foot"><button type="submit" class="btn btn-ink">Show the answer</button></div>`;
  } else {
    const match = q.attempt && normalize(q.attempt) === normalize(c.suggestion);
    body = `<div class="flash-answer tone-${P(c.author).tone}${q.anim === 'flip' ? ' flip-in' : ''}">
        ${q.attempt ? `<p class="flash-yours">You wrote: ${esc(q.attempt)}${match ? ' <strong>Spot on!</strong>' : ''}</p>` : ''}
        <p class="pen flash-fix">${esc(c.suggestion)}</p>
        ${c.why ? `<p class="fix-why">${esc(c.why)}</p>` : ''}
      </div>
      <div class="flash-foot">
        <button type="button" class="btn btn-line" data-action="quiz-grade" data-ok="0">Not yet</button>
        <button type="button" class="btn btn-ink" data-action="quiz-grade" data-ok="1" data-first>I knew it</button>
      </div>`;
  }
  return `${head}<form class="flash${q.anim === 'in' ? ' card-in' : ''}" data-form="quiz">
    <p class="flash-count">Card ${q.i + 1} of ${q.deck.length}, from ${whose} letter on day ${dayNumber(c.date, startDate())}</p>
    <blockquote class="flash-ctx tone-${P(c.target).tone}">${esc(before)}<mark class="wrong">${esc(c.original)}</mark>${esc(after)}</blockquote>
    ${body}
  </form>`;
}

// ---------- connection check ----------

function checkView() {
  const them = IDS[1];
  const results = state.check?.results ?? [];
  const done = state.check?.done;
  const rows = CHECKS.map((c, i) => {
    const r = results[i];
    const status = r ? `is-${r.status}` : 'is-testing';
    const text = !r ? 'Testing…' : r.status === 'fail' ? 'Blocked' : `${r.status === 'slow' ? 'Slow' : 'Works'}, ${r.ms} ms`;
    return `<li class="check-row ${status}" style="--i:${i}">
      <span class="check-icon" aria-hidden="true"></span>
      <span class="check-name">${esc(c.name)}<small>${esc(c.note)}</small></span>
      <span class="check-result">${text}</span>
    </li>`;
  }).join('');
  return `<section class="page-head"><h1 class="page-title">Connection check</h1>
      <p class="page-lede">Hi ${nameOf(them)}! This page tests which websites work from your internet. It takes about 20 seconds. When it's done, tap “Copy results” and send them to ${nameOf(IDS[0])}, or send a screenshot.</p></section>
    <ul class="checks" aria-live="polite">${rows}</ul>
    <div class="check-foot">
      <button type="button" class="btn btn-ink" data-action="check-copy"${done ? '' : ' disabled'}>Copy results</button>
      <button type="button" class="btn btn-line" data-action="check-run"${done ? '' : ' disabled'}>Test again</button>
    </div>`;
}

async function runCheck() {
  const run = { results: [], done: false };
  state.check = run;
  const here = location.href.split('#')[0];
  await Promise.all(CHECKS.map(async (c, i) => {
    run.results[i] = await probe(c.url ?? here);
    if (state.check === run && route().page === 'check') softRender();
  }));
  run.done = true;
  if (state.check === run && route().page === 'check') softRender();
}

function checkReport() {
  const where = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const lines = CHECKS.map((c, i) => {
    const r = state.check.results[i];
    return `${c.name}: ${r.status === 'fail' ? 'BLOCKED' : `${r.status.toUpperCase()} (${r.ms} ms)`}`;
  });
  return [`halfway connection check, ${when} (${where})`, ...lines].join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

// ---------- actions ----------

async function closeFix() {
  await play(app.querySelector('.overlay'), 'closing', 180);
  state.fixDraft = null;
  render();
}

function showFix(id) {
  const li = document.getElementById(`fix-${id}`);
  if (!li) return;
  li.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  li.classList.remove('flash');
  void li.offsetWidth;
  li.classList.add('flash');
}

const actions = {
  be(el) {
    state.me = el.dataset.id;
    local.set('halfway:me', state.me);
    const url = new URL(location.href);
    url.searchParams.set('as', state.me);
    history.replaceState(null, '', url);
    state.quiz = null;
    state.fixDraft = null;
    state.editing.clear();
    state.entering = true;
    render();
  },
  async demo() {
    if (state.data.answers.length && !confirm('Replace everything in this browser with the example letters?')) return;
    const db = buildDemo(state.today);
    await store.replaceAll(db);
    clearDeviceState();
    // Past letters count as already opened; today's stays sealed.
    const past = [...new Set(Object.values(db.answers).map((a) => a.date))].filter((d) => d !== state.today);
    for (const id of IDS) local.set(seenKey(id), past);
    state.entering = true;
    await refresh();
  },
  async wipe() {
    if (!confirm('Delete every letter and fix saved in this browser?')) return;
    await store.reset();
    clearDeviceState();
    state.entering = true;
    await refresh();
  },
  edit(el) {
    state.editing.add(el.dataset.date);
    state.focusAfter = 'textarea.ruled';
    render();
  },
  'cancel-edit'(el) {
    state.editing.delete(el.dataset.date);
    local.del(draftKey(el.dataset.date));
    render();
  },
  async open(el) {
    const date = el.dataset.date;
    await play(el.closest('.envelope'), 'opening', 950);
    markSeen(date);
    state.justOpened = date;
    render();
  },
  async accept(el) {
    await store.updateCorrection(el.dataset.id, { status: 'accepted' });
    state.fresh.add(el.dataset.id);
    state.bump = true;
    await refresh();
  },
  async dispute(el) {
    await store.updateCorrection(el.dataset.id, { status: 'disputed' });
    state.fresh.add(el.dataset.id);
    await refresh();
  },
  async 'delete-fix'(el) {
    await play(el.closest('.fix'), 'leaving', 300);
    await store.deleteCorrection(el.dataset.id);
    await refresh();
  },
  'close-fix'() {
    closeFix();
  },
  'nb-tab'(el) {
    if (state.notebookTab === el.dataset.tab) return;
    state.notebookTab = el.dataset.tab;
    state.deal = true;
    render();
  },
  'quiz-start'(el) {
    startQuiz(el.dataset.set);
    state.focusAfter = '[name=attempt]';
    render();
  },
  async 'quiz-grade'(el) {
    const q = state.quiz;
    const id = q.deck[q.i];
    const ok = el.dataset.ok === '1';
    if (ok) {
      const b = el.getBoundingClientRect();
      confetti(b.left + b.width / 2, b.top + b.height / 2, 18);
    }
    const scores = local.get(quizKey(), {});
    const s = scores[id] ?? { ok: 0, ko: 0 };
    s[ok ? 'ok' : 'ko'] += 1;
    scores[id] = s;
    local.set(quizKey(), scores);
    await play(app.querySelector('.flash'), ok ? 'leave-ok' : 'leave-ko', 340);
    q.right += ok ? 1 : 0;
    q.i += 1;
    q.revealed = false;
    q.attempt = '';
    q.anim = 'in';
    state.focusAfter = '[name=attempt]';
    render();
  },
  'quiz-exit'() {
    state.quiz = null;
    render();
  },
  'check-run'() {
    state.check = null;
    render();
  },
  async 'check-copy'(el) {
    const ok = await copyText(checkReport());
    el.textContent = ok ? 'Copied!' : 'Copy failed, send a screenshot';
  },
};

async function sendAnswer(form) {
  const date = form.dataset.date;
  const text = form.querySelector('textarea').value.trim();
  if (countWords(text) < MIN_WORDS) return;
  const mine = answerOf(date, state.me);
  if (mine && answerOf(date, other())) return; // both letters are in: locked
  if (!mine) {
    const letter = form.closest('.letter');
    const target = app.querySelector('.letter.theirs');
    setTimeout(() => flyPlane(letter, target, P(state.me).tone), 260);
    await play(letter, 'sending', 480);
  }
  await store.saveAnswer(date, state.me, text);
  local.del(draftKey(date));
  state.editing.delete(date);
  state.justSent = date;
  await refresh();
}

async function sendFix(form) {
  const d = state.fixDraft;
  const err = form.querySelector('[data-err]');
  const suggestion = form.suggestion.value.trim();
  if (!suggestion) {
    err.textContent = 'Write the better version first.';
    form.suggestion.focus();
    return;
  }
  if (suggestion === d.original) {
    err.textContent = "That's the same as the original. Change something, or cancel.";
    form.suggestion.focus();
    return;
  }
  const a = answerById(d.answerId);
  if (!a || a.text.slice(d.start, d.end) !== d.original) {
    err.textContent = 'This letter changed in the meantime. Close this and select the words again.';
    return;
  }
  const id = await store.addCorrection({
    answerId: d.answerId, date: d.date, author: state.me, target: other(),
    start: d.start, end: d.end, original: d.original,
    suggestion, why: form.why.value.trim(), unsure: form.unsure.checked,
  });
  await play(form.closest('.overlay'), 'closing', 180);
  state.fixDraft = null;
  state.fresh.add(id);
  getSelection()?.removeAllRanges();
  await refresh();
}

// ---------- events ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el) {
    if (!animating) actions[el.dataset.action]?.(el, e);
    return;
  }
  if (e.target.matches('[data-overlay]')) {
    closeFix();
    return;
  }
  const mark = e.target.closest('mark[data-fix]');
  if (mark && getSelection().isCollapsed) showFix(mark.dataset.fix);
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (animating) return;
  const form = e.target;
  if (form.dataset.form === 'answer') sendAnswer(form);
  else if (form.dataset.form === 'fix') sendFix(form);
  else if (form.dataset.form === 'quiz' && state.quiz) {
    state.quiz.attempt = form.attempt?.value.trim() ?? '';
    state.quiz.revealed = true;
    state.quiz.anim = 'flip';
    state.focusAfter = '[data-first]';
    render();
  }
});

document.addEventListener('input', (e) => {
  const ta = e.target;
  if (!ta.matches?.('textarea[data-draft]')) return;
  local.set(draftKey(ta.dataset.draft), ta.value);
  grow(ta);
  const w = countWords(ta.value);
  ta.form.querySelector('[data-wc]').textContent = wordsLabel(w);
  const send = ta.form.querySelector('[data-send]');
  const wasOff = send.disabled;
  send.disabled = w < MIN_WORDS;
  if (wasOff && !send.disabled && !calm) {
    send.classList.remove('ready-pop');
    void send.offsetWidth;
    send.classList.add('ready-pop');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.fixDraft) closeFix();
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.matches?.('textarea[data-draft]')) e.target.form.requestSubmit();
});

document.addEventListener('focusout', () => {
  setTimeout(() => {
    if (pending && !busy()) render();
  }, 0);
});

addEventListener('hashchange', () => {
  state.fixDraft = null;
  state.entering = true;
  render();
  scrollTo(0, 0);
});

// Selecting words in the other person's letter shows the "Suggest a fix" button.
let picked = null;
let hideTimer = 0;

const closestEl = (node, selector) => (node.nodeType === 1 ? node : node.parentElement)?.closest(selector);

function offsetIn(rootEl, node, offset) {
  const r = document.createRange();
  r.selectNodeContents(rootEl);
  r.setEnd(node, offset);
  return r.toString().length;
}

function hideFab() {
  fab.classList.remove('show');
  picked = null;
}

document.addEventListener('selectionchange', () => {
  if (state.fixDraft) return;
  const sel = getSelection();
  const range = sel.rangeCount && !sel.isCollapsed ? sel.getRangeAt(0) : null;
  const box = range ? closestEl(range.commonAncestorContainer, '[data-correctable]') : null;
  if (!box) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideFab, 350);
    return;
  }
  const text = box.textContent;
  const a = offsetIn(box, range.startContainer, range.startOffset);
  const b = offsetIn(box, range.endContainer, range.endOffset);
  const { start, end } = snapToWords(text, Math.min(a, b), Math.max(a, b));
  if (end <= start || end - start > 300) {
    hideFab();
    return;
  }
  clearTimeout(hideTimer);
  const same = picked && picked.start === start && picked.end === end;
  picked = { answerId: box.dataset.answer, date: box.dataset.date, start, end, original: text.slice(start, end) };
  if (!same) fab.innerHTML = `<span class="fab-pen" aria-hidden="true">✏️</span> Suggest a fix for “${esc(clip(picked.original, 26))}”`;
  fab.classList.add('show');
});

fab.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the selection alive
fab.addEventListener('click', () => {
  const a = picked && answerById(picked.answerId);
  if (!a) return;
  const { before, after } = contextOf(a.text, picked.start, picked.end);
  state.fixDraft = { ...picked, before, after, focus: true };
  hideFab();
  render();
});

// Clocks tick, and the page rolls over to the new question at midnight UTC.
setInterval(() => {
  const t = todayKey();
  if (t !== state.today) {
    state.today = t;
    softRender();
    return;
  }
  for (const id of IDS) {
    const c = localClock(P(id).tz);
    const m = moodOf(c);
    document.querySelectorAll(`[data-clock="${id}"]`).forEach((el) => { el.innerHTML = timeHTML(c.time); });
    document.querySelectorAll(`[data-mood="${id}"]`).forEach((el) => {
      el.innerHTML = moodHTML(m);
      el.title = m.text;
    });
  }
  document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = countdown(); });
}, 15000);

store.onChange(async () => {
  state.data = await store.load();
  softRender();
});

mountLogo();
refresh();
