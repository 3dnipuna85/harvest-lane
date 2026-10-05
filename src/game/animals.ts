import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { now } from './clock';
import { add, gainXP, inv, type BuyResult } from './economy';
import { emit } from './events';
import { S } from './state';
import { maxAnimals } from './town';

export const animalUnlocked = (k: AnimalId) => S.level >= ANIMALS[k].lvl;
export const animalCost = (k: AnimalId) => Math.round(ANIMALS[k].cost * Math.pow(1.6, Math.max(0, S.animals[k].n - ANIMALS[k].start)));

export type AnimalState = 'hungry' | 'busy' | 'ready';
export function animalState(k: AnimalId, i: number, t = now()): AnimalState {
  const r = S.animals[k].ready[i];
  return r == null ? 'hungry' : t >= r ? 'ready' : 'busy';
}

/** 0 to 1 while the animal is making its product. */
export function animalProgress(k: AnimalId, i: number, t = now()) {
  const r = S.animals[k].ready[i];
  if (r == null) return 0;
  return Math.min(1, 1 - (r - t) / (ANIMALS[k].time * 1000));
}

export type FeedResult = 'fed' | 'locked' | 'busy' | 'nofeed';

export function feedAnimal(k: AnimalId, i: number, t = now()): FeedResult {
  const a = ANIMALS[k], h = S.animals[k];
  if (!animalUnlocked(k)) return 'locked';
  if (i >= h.n || h.ready[i] != null) return 'busy';
  if (inv(a.feed) < a.feedQty) return 'nofeed';
  S.inv[a.feed] = inv(a.feed) - a.feedQty;
  h.ready[i] = t + a.time * 1000;
  emit('animalFed', { kind: k, i });
  return 'fed';
}

export function collectAnimal(k: AnimalId, i: number, t = now()): boolean {
  if (animalState(k, i, t) !== 'ready') return false;
  const a = ANIMALS[k];
  S.animals[k].ready[i] = null;
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
  return { ok: true };
}
