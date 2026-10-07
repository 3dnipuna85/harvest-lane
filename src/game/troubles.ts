import { now } from './clock';
import { gainXP, inv, ripe } from './economy';
import { emit } from './events';
import { S, type Trouble } from './state';

/**
 * Trouble on the farm, now and then while you play (from level 3):
 *  - Heavy rain: crops grow at half speed, and ripe crops left out in it rot three times as fast. Harvest!
 *  - Dry spell: growing crops stop growing until you water them (tap each plot, or pay to water them all).
 *  - Crows: they land on your crops and eat them unless you shoo them off in time.
 *  - A fox: it creeps up to the hen house and steals eggs and milk from the barn unless you chase it away.
 */
export const TROUBLE_LVL = 3;
export const RAIN_MS = 150_000, DRY_MS = 180_000;
/** Crows eat their plot this long after landing; the fox raids this long after showing up. */
export const CROW_MS = 25_000, FOX_MS = 30_000;
export const FOX_HP = 3;
/** With a crop drone, crows are chased off this long after landing. */
export const DRONE_SHOO_MS = 5000;
export const RAIN_GROW = 0.5, RAIN_ROT = 3;
export const nextGap = (rand = Math.random) => (7 + rand() * 7) * 60_000;
export const waterAllCost = () => 4 * S.plots.length + 10 * S.level;

export const trouble = (t = now()) => (S.trouble && t < S.trouble.end ? S.trouble : null);
const growing = (i: number) => { const p = S.plots[i]; return !!p.crop && !ripe(p); };
/** Sprinklers (data/tech.ts) water the field themselves, so nothing goes thirsty. */
export const thirsty = (i: number) => S.trouble?.kind === 'dry' && !S.tech?.includes('sprinkler') && growing(i) && !S.trouble.wet!.includes(i);

export function startTrouble(kind: Trouble['kind'], t = now(), rand = Math.random) {
  let tr: Trouble;
  if (kind === 'rain') tr = { kind, start: t, end: t + RAIN_MS };
  else if (kind === 'dry') tr = { kind, start: t, end: t + DRY_MS, wet: [] };
  else if (kind === 'crows') {
    const n = Math.min(6, 3 + Math.floor(S.level / 6));
    const spots = S.plots.map((p, i) => (p.crop ? i : -1)).filter(i => i >= 0).sort(() => rand() - 0.5).slice(0, n);
    if (!spots.length) return false;
    tr = { kind, start: t, end: t + CROW_MS + 1000, crows: spots.map((i, k) => ({ i, at: t + CROW_MS + k * 1500 })) };
  } else tr = { kind, start: t, end: t + FOX_MS + 1000, hp: FOX_HP };
  S.trouble = tr;
  emit('troubleStart', { kind });
  return true;
}

let lastT = 0;
export function troubleTick(t = now(), rand = Math.random) {
  // Real time since the last tick (the frame step is capped, so it can't be used to move crop clocks).
  const ms = lastT && t > lastT ? Math.min(5000, t - lastT) : 0;
  lastT = t;
  if (S.level < TROUBLE_LVL) return;
  // Back from time away (or an old save): give the player a few calm minutes first.
  if (!S.nextTrouble || S.nextTrouble < t - 60_000) S.nextTrouble = t + (2 + rand() * 3) * 60_000;
  const tr = S.trouble;
  if (!tr) {
    if (t >= S.nextTrouble) {
      const kinds: Trouble['kind'][] = ['rain', 'dry', 'crows'];
      if (S.level >= 4) kinds.push('fox');
      if (!startTrouble(kinds[Math.floor(rand() * kinds.length)], t, rand)) S.nextTrouble = t + 60_000;
    }
    return;
  }
  if (tr.kind === 'rain') S.plots.forEach((p, i) => {
    if (!p.crop) return;
    // Pushing the planting time forward slows growth; pulling a ripe crop's back brings its rot closer.
    if (growing(i)) p.at += ms * (1 - RAIN_GROW);
    else p.at -= ms * (RAIN_ROT - 1);
  });
  if (tr.kind === 'dry') S.plots.forEach((p, i) => { if (thirsty(i)) p.at += ms; });
  if (tr.kind === 'crows' && S.tech?.includes('drone') && t >= tr.start + DRONE_SHOO_MS) {
    // The crop drone chases the crows off by itself (no XP: the player didn't do it).
    for (const c of tr.crows!) emit('crowShooed', { i: c.i });
    tr.crows = [];
    emit('troubleBeaten', { kind: 'crows' });
    return endTrouble(t, rand, false);
  }
  if (tr.kind === 'crows') {
    for (const c of tr.crows!.slice()) {
      if (t < c.at) continue;
      const p = S.plots[c.i];
      if (p.crop) { emit('cropEaten', { i: c.i, crop: p.crop }); p.crop = null; p.at = 0; }
      tr.crows!.splice(tr.crows!.indexOf(c), 1);
    }
    if (!tr.crows!.length) return endTrouble(t, rand, false);
    tr.end = Math.max(...tr.crows!.map(c => c.at)) + 1000;
  }
  if (tr.kind === 'fox' && t >= tr.start + FOX_MS) {
    const stolen: Record<string, number> = {};
    for (const k of ['egg', 'milk'] as const) {
      const n = Math.min(inv(k), Math.max(3, Math.ceil(inv(k) * 0.3)));
      if (n > 0) { S.inv[k] = inv(k) - n; stolen[k] = n; }
    }
    emit('foxStole', { egg: stolen.egg || 0, milk: stolen.milk || 0 });
    return endTrouble(t, rand, false);
  }
  if (t >= tr.end) endTrouble(t, rand, tr.kind === 'rain' || tr.kind === 'dry');
}

function endTrouble(t: number, rand: () => number, weather: boolean) {
  const kind = S.trouble!.kind;
  S.trouble = null;
  S.nextTrouble = t + nextGap(rand);
  emit('troubleEnd', { kind, weather });
}

/** Water one thirsty plot (free, by hand). */
export function water(i: number) {
  if (!thirsty(i)) return false;
  S.trouble!.wet!.push(i);
  emit('watered', { i });
  return true;
}
/** Pay to water every plot at once. */
export function waterAll(): { ok: boolean; cost: number } {
  const c = waterAllCost(), tr = S.trouble;
  if (tr?.kind !== 'dry' || S.coins < c) return { ok: false, cost: c };
  S.coins -= c;
  tr.wet = S.plots.map((_, i) => i);
  emit('watered', { i: -1 });
  return { ok: true, cost: c };
}

/** Shoo the crow on plot i. */
export function shooCrow(i: number, t = now(), rand = Math.random) {
  const tr = S.trouble;
  if (tr?.kind !== 'crows') return false;
  const k = tr.crows!.findIndex(c => c.i === i);
  if (k < 0) return false;
  tr.crows!.splice(k, 1);
  gainXP(1);
  emit('crowShooed', { i });
  if (!tr.crows!.length) { emit('troubleBeaten', { kind: 'crows' }); endTrouble(t, rand, false); }
  return true;
}

/** Chase the fox: a few taps send it running. */
export function chaseFox(t = now(), rand = Math.random) {
  const tr = S.trouble;
  if (tr?.kind !== 'fox') return false;
  tr.hp = (tr.hp ?? FOX_HP) - 1;
  emit('foxHit', { left: tr.hp });
  if (tr.hp <= 0) { gainXP(5); emit('troubleBeaten', { kind: 'fox' }); endTrouble(t, rand, false); }
  return true;
}

