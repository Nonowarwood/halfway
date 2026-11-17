import { daysBetween } from './days.js';

// The plant between the two letters. It grows one step for every day
// you both wrote, and gets thirsty when a day is missed. It never dies.
// Class names (p-stem, p-leaf, p-bloom…) are animation hooks for style.css.

const INK = '#24305e';
const TONES = { blue: '#9fb6f5', rose: '#f6a5b8' };

export function plantState(togetherDates, today) {
  const count = togetherDates.length;
  if (!count) return { count, mood: 'seed' };
  const gap = daysBetween(togetherDates[count - 1], today);
  const mood = gap <= 0 ? 'happy' : gap === 1 ? 'ok' : gap <= 3 ? 'thirsty' : 'wilted';
  return { count, mood };
}

const f1 = (n) => n.toFixed(1);
const pt = ([x, y]) => `${f1(x)} ${f1(y)}`;

function bezier(p, t) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p[0][i] + 3 * u * u * t * p[1][i] + 3 * u * t * t * p[2][i] + t * t * t * p[3][i]);
}

function leaf(x, y, side, angle, L, fill, stroke, i) {
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${side} 1) rotate(${f1(angle)})"><g class="p-leaf" style="--i:${i}">`
    + `<path d="M0 0Q${f1(L * 0.5)} ${f1(-L * 0.42)} ${f1(L)} 0Q${f1(L * 0.5)} ${f1(L * 0.42)} 0 0Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<path d="M2 0H${f1(L * 0.78)}" stroke="${stroke}" stroke-width=".9" stroke-linecap="round" opacity=".55"/></g></g>`;
}

// Petals alternate between the two inks: one flower, both of you.
function flower(x, y, k, [a, b], faded, i) {
  let s = `<g transform="translate(${f1(x)} ${f1(y)}) scale(${k})"${faded ? ' opacity=".6"' : ''}><g class="p-bloom" style="--i:${i}">`;
  for (let j = 0; j < 6; j++) {
    s += `<ellipse cy="-7.5" rx="4.8" ry="7" transform="rotate(${j * 60})" fill="${j % 2 ? b : a}" stroke="${INK}" stroke-width=".9"/>`;
  }
  return s + `<circle r="4.4" fill="#ffd36e" stroke="${INK}" stroke-width=".9"/></g></g>`;
}

function bud(x, y, color, leafFill, green) {
  return `<g transform="translate(${f1(x)} ${f1(y)})"><g class="p-bloom" style="--i:0">`
    + `<ellipse cy="-6" rx="4.5" ry="7" fill="${color}" stroke="${INK}" stroke-width=".9"/>`
    + `<path d="M-5.5 -1Q0 -7 5.5 -1Q0 2 -5.5 -1Z" fill="${leafFill}" stroke="${green}" stroke-width="1"/></g></g>`;
}

const DROP = 'M0-6C3-1 4 2 0 4C-4 2-3-1 0-6Z';

export function plantSVG(count, mood, tones, label) {
  const [ta, tb] = tones.map((t) => TONES[t] ?? TONES.blue);
  const cx = 80;
  const rimT = 142;
  const rimB = 155;
  const potB = 206;
  const wT = 40;
  const wB = 30;
  const base = rimT + 1;
  const g = Math.min(count, 30);
  const droop = { seed: 0, happy: 0, ok: 5, thirsty: 26, wilted: 52 }[mood] ?? 0;
  const dry = mood === 'wilted';
  const leafFill = dry ? '#d3c79c' : mood === 'thirsty' ? '#acd09f' : '#8fd3a4';
  const green = dry ? '#a39566' : '#4f9a6c';

  let plant = '';
  let topY;
  if (!count) {
    plant += `<path class="p-stem" pathLength="1" d="M${cx} ${base}q1-7-1-12" fill="none" stroke="${green}" stroke-width="2.6" stroke-linecap="round"/>`;
    plant += leaf(cx - 1, base - 12, 1, -35, 10, leafFill, green, 0) + leaf(cx - 1, base - 12, -1, -35, 9, leafFill, green, 1);
    topY = base - 24;
  } else {
    const h = 18 + g * 3.4;
    const P = [[cx, base], [cx - 8, base - h * 0.35], [cx + 8, base - h * 0.7], [cx + droop * 0.5, base - h + droop * 0.35]];
    const at = (t) => bezier(P, t);
    topY = P[3][1] - (g >= 7 ? 16 : g >= 4 ? 14 : 6);

    const branches = [];
    if (g >= 14) branches.push({ t: 0.62, side: 1 });
    if (g >= 21) branches.push({ t: 0.42, side: -1 });
    for (const [k, br] of branches.entries()) {
      const [x, y] = at(br.t);
      br.end = [x + br.side * 21, y - 14 + droop * 0.5];
      topY = Math.min(topY, br.end[1] - 12);
      plant += `<path class="p-stem p-branch" style="--i:${k + 1}" pathLength="1" d="M${pt([x, y])}Q${pt([x + br.side * 14, y - 2])} ${pt(br.end)}" fill="none" stroke="${green}" stroke-width="2.2" stroke-linecap="round"/>`;
    }

    plant += `<path class="p-stem" pathLength="1" d="M${pt(P[0])}C${pt(P[1])} ${pt(P[2])} ${pt(P[3])}" fill="none" stroke="${green}" stroke-width="3.2" stroke-linecap="round"/>`;

    const leaves = Math.min(2 + Math.floor(g / 2), 14);
    for (let i = 0; i < leaves; i++) {
      const t = 0.1 + (i / leaves) * 0.8;
      const [x, y] = at(t);
      const L = 12 + 9 * (1 - t) + Math.min(g, 20) * 0.25;
      plant += leaf(x, y, i % 2 ? -1 : 1, -30 + droop, L, leafFill, green, i);
    }

    for (const [k, br] of branches.entries()) plant += flower(br.end[0], br.end[1], 0.75, [ta, tb], dry, k + 1);
    const top = P[3];
    if (g >= 7) plant += flower(top[0], top[1] - 2, 1, [ta, tb], dry, 0);
    else if (g >= 4) plant += bud(top[0], top[1], tb, leafFill, green);
  }

  // Pot: one half in each person's colour.
  const x0 = cx - wT - 5;
  const x1 = cx + wT + 5;
  const pot = `<path d="M${cx - wT} ${rimB}H${cx}V${potB}H${cx - wB}Z" fill="${ta}"/>`
    + `<path d="M${cx} ${rimB}H${cx + wT}L${cx + wB} ${potB}H${cx}Z" fill="${tb}"/>`
    + `<path d="M${cx - wT} ${rimB}H${cx + wT}L${cx + wB} ${potB}H${cx - wB}Z" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M${x0 + 4} ${rimT}H${cx}V${rimB}H${x0 + 4}Q${x0} ${rimB} ${x0} ${rimB - 4}V${rimT + 4}Q${x0} ${rimT} ${x0 + 4} ${rimT}Z" fill="${ta}"/>`
    + `<path d="M${cx} ${rimT}H${x1 - 4}Q${x1} ${rimT} ${x1} ${rimT + 4}V${rimB - 4}Q${x1} ${rimB} ${x1 - 4} ${rimB}H${cx}Z" fill="${tb}"/>`
    + `<rect x="${x0}" y="${rimT}" width="${x1 - x0}" height="${rimB - rimT}" rx="4" fill="none" stroke="${INK}" stroke-width="2"/>`
    + `<ellipse cx="${cx}" cy="${rimT + 1}" rx="${wT}" ry="4" fill="#7a5c4a" stroke="${INK}" stroke-width="1.5"/>`;

  const mouths = {
    seed: `M${cx - 6} 181q6 6 12 0`,
    happy: `M${cx - 6} 181q6 6 12 0`,
    ok: `M${cx - 4} 182q4 3 8 0`,
    thirsty: `M${cx - 4} 184q4-1.5 8 0`,
    wilted: `M${cx - 5} 186q5-5 10 0`,
  };
  const blush = mood === 'happy' || mood === 'ok' || mood === 'seed';
  const face = `<g class="p-eyes"><circle cx="${cx - 11}" cy="175" r="2.3" fill="${INK}"/><circle cx="${cx + 11}" cy="175" r="2.3" fill="${INK}"/></g>`
    + `<path d="${mouths[mood]}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
    + (blush ? `<ellipse cx="${cx - 20}" cy="181" rx="4.5" ry="2.6" fill="#f48fa8" opacity=".55"/><ellipse cx="${cx + 20}" cy="181" rx="4.5" ry="2.6" fill="#f48fa8" opacity=".55"/>` : '');
  const sweat = mood === 'thirsty' || mood === 'wilted'
    ? `<g class="p-sweat"><path transform="translate(${cx + 30} 166)" d="${DROP}" fill="#bfe0ff" stroke="${INK}" stroke-width=".9"/></g>`
    : '';

  // Water drops, only visible while the plant is being watered.
  const dropY = topY - 24;
  const fall = Math.round(base - 6 - dropY);
  const water = [-16, 2, 18].map((dx, i) =>
    `<g class="drop" style="--fall:${fall}px;--d:${(i * 0.17).toFixed(2)}s"><path transform="translate(${cx + dx} ${f1(dropY)}) scale(1.3)" d="${DROP}" fill="#bfe0ff" stroke="${INK}" stroke-width=".8"/></g>`).join('');

  // Crop empty sky above small plants so the pot keeps its size.
  const vbTop = Math.max(0, Math.min(100, Math.floor(topY - 40)));
  return `<svg viewBox="0 ${vbTop} 160 ${212 - vbTop}" role="img" aria-label="${label}">`
    + `<g class="p-plant${mood === 'happy' ? ' sway' : ''}"><g class="p-perk">${plant}</g></g>`
    + `${pot}${face}${sweat}<g class="p-water" aria-hidden="true">${water}</g></svg>`;
}
