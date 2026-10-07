import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { PEN_SPEED } from '../data/buildings';
import { now } from './clock';
import { add, gainXP, inv, type BuyResult } from './economy';
import { emit } from './events';
import { S } from './state';
import { maxAnimals } from './town';

/** Seconds an animal takes to make its product; better pens (data/buildings.ts) make it quicker. */
export const animalTime = (k: AnimalId) => ANIMALS[k].time * Math.pow(1 - PEN_SPEED, S.build?.pens || 0);
export const animalUnlocked = (k: AnimalId) => S.level >= ANIMALS[k].lvl;
export const animalCost = (k: AnimalId) => Math.round(ANIMALS[k].cost * Math.pow(1.6, Math.max(0, S.animals[k].n - ANIMALS[k].start)));

/** An animal left hungry this long falls sick: it stops producing and won't eat until the vet treats it. */
export const SICK_AFTER_MS = 30 * 60_000;
/** The vet's fee for one animal. */
export const vetCost = (k: AnimalId) => Math.round(ANIMALS[k].cost * 0.3 + 10 * S.level);

export type AnimalState = 'hungry' | 'busy' | 'ready' | 'sick';
export function animalState(k: AnimalId, i: number, t = now()): AnimalState {
  const h = S.animals[k], r = h.ready[i];
  if (h.sick[i]) return 'sick';
  if (r == null) {
    const since = h.hungry[i];
    if (since != null && t - since >= SICK_AFTER_MS) { h.sick[i] = true; emit('animalSick', { kind: k, i }); return 'sick'; }
    return 'hungry';
  }
  return t >= r ? 'ready' : 'busy';
}
/** Minutes of hunger left before an animal falls sick (for warnings). */
export const sickIn = (k: AnimalId, i: number, t = now()) => {
  const since = S.animals[k].hungry[i];
  return since == null ? Infinity : SICK_AFTER_MS - (t - since);
};
export function sickCount(k?: AnimalId, t = now()) {
  let n = 0;
  for (const a of k ? [k] : ANIMAL_IDS) if (animalUnlocked(a)) for (let i = 0; i < S.animals[a].n; i++) if (animalState(a, i, t) === 'sick') n++;
  return n;
}

/** Check every animal for sickness (from the sim, so it also happens while nobody is looking). */
export function animalTick(t = now()) {
  for (const k of ANIMAL_IDS) if (animalUnlocked(k)) for (let i = 0; i < S.animals[k].n; i++) animalState(k, i, t);
}

/** The vet treats every sick animal it can afford, most valuable first. Returns how many were healed and the fee. */
export function healAll(t = now()) {
  let healed = 0, paid = 0;
  for (const k of ANIMAL_IDS.slice().sort((a, b) => ANIMALS[b].cost - ANIMALS[a].cost)) {
    const h = S.animals[k];
    for (let i = 0; i < h.n; i++) {
      if (!h.sick[i]) continue;
      const c = vetCost(k);
      if (S.coins < c) continue;
      S.coins -= c; paid += c; healed++;
      h.sick[i] = false; h.hungry[i] = t;
    }
  }
  return { healed, paid };
}

/** 0 to 1 while the animal is making its product. */
export function animalProgress(k: AnimalId, i: number, t = now()) {
  const r = S.animals[k].ready[i];
  if (r == null) return 0;
  return Math.min(1, 1 - (r - t) / (animalTime(k) * 1000));
}

export type FeedResult = 'fed' | 'locked' | 'busy' | 'nofeed' | 'sick';

export function feedAnimal(k: AnimalId, i: number, t = now()): FeedResult {
  const a = ANIMALS[k], h = S.animals[k];
  if (!animalUnlocked(k)) return 'locked';
  if (i >= h.n) return 'busy';
  if (animalState(k, i, t) === 'sick') return 'sick';
  if (h.ready[i] != null) return 'busy';
  if (inv(a.feed) < a.feedQty) return 'nofeed';
  S.inv[a.feed] = inv(a.feed) - a.feedQty;
  h.ready[i] = t + animalTime(k) * 1000;
  h.hungry[i] = null;
  emit('animalFed', { kind: k, i });
  return 'fed';
}

export function collectAnimal(k: AnimalId, i: number, t = now()): boolean {
  if (animalState(k, i, t) !== 'ready') return false;
  const a = ANIMALS[k];
  S.animals[k].ready[i] = null;
  S.animals[k].hungry[i] = t;
  add(a.product, 1);
  S.made[a.product] = (S.made[a.product] || 0) + 1;
  gainXP(a.xp);
  emit('animalCollect', { kind: k, i, product: a.product });
  return true;
}

/** Tap an animal: collect if ready, otherwise feed it. */
export function tapAnimal(k: AnimalId, i: number): FeedResult | 'collected' {
  return collectAnimal(k, i) ? 'collected' : feedAnimal(k, i);
}

/** Collect everything ready, then feed every hungry animal the barn can afford. Returns counts. */
export function tendAll(t = now()) {
  let got = 0, fed = 0;
  for (const k of ANIMAL_IDS) {
    if (!animalUnlocked(k)) continue;
    for (let i = 0; i < S.animals[k].n; i++) {
      if (collectAnimal(k, i, t)) got++;
      if (feedAnimal(k, i, t) === 'fed') fed++;
    }
  }
  return { got, fed };
}

export function buyAnimal(k: AnimalId): BuyResult {
  const h = S.animals[k], c = animalCost(k);
  if (!animalUnlocked(k)) return { ok: false, reason: 'locked' };
  if (h.n >= maxAnimals(k)) return { ok: false, reason: 'max' };
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  h.n++;
  h.ready.push(null);
  h.hungry.push(now());
  h.sick.push(false);
  return { ok: true };
}
