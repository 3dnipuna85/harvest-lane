import { now } from './clock';
import { add, gainXP } from './economy';
import { gainGems } from './estate';
import { emit } from './events';
import { S } from './state';

/**
 * Areas found past level 21, across the river: the Apple Orchard (pick ripe trees for apples, they ripen again)
 * and the Crystal Cave (tough crystal rocks: stone, crystals to sell, and now and then a diamond).
 */
export const ORCHARD_LVL = 23, CAVE_LVL = 27;
export const APPLE_TREES = 8, CAVE_ROCKS = 5;
export const APPLE_REGROW_MS = 6 * 60_000, CAVE_REGROW_MS = 10 * 60_000;
export const CAVE_HITS = 6;
export const CRYSTAL_CHANCE = 0.4, CAVE_GEM = 0.15;

export const orchardOpen = () => S.level >= ORCHARD_LVL;
export const caveOpen = () => S.level >= CAVE_LVL;
/** A tree is ripe once its regrow time has passed (0 = ripe now). */
export const appleRipe = (i: number, t = now()) => orchardOpen() && (S.orchard[i] || 0) <= t;
export const crystalUp = (i: number, t = now()) => caveOpen() && (S.cave[i] || 0) <= t;

const hits = new Map<number, number>();
export const caveHitsOn = (i: number) => hits.get(i) || 0;

export type PickResult = 'locked' | 'growing' | 'hit' | 'done';

export function pickApples(i: number, t = now(), rand = Math.random): PickResult {
  if (!orchardOpen()) return 'locked';
  if (!appleRipe(i, t)) return 'growing';
  const n = 3 + (rand() < 0.3 ? 1 : 0);
  add('apple', n);
  S.made.apple = (S.made.apple || 0) + n;
  S.orchard[i] = t + APPLE_REGROW_MS;
  gainXP(5);
  emit('applesPicked', { i, n });
  return 'done';
}

export function mineCrystal(i: number, t = now(), rand = Math.random): PickResult {
  if (!caveOpen()) return 'locked';
  if (!crystalUp(i, t)) return 'growing';
  const n = caveHitsOn(i) + 1;
  if (n < CAVE_HITS) { hits.set(i, n); emit('crystalHit', { i }); return 'hit'; }
  hits.delete(i);
  const stone = 3 + (rand() < 0.3 ? 1 : 0), crystal = rand() < CRYSTAL_CHANCE ? 1 : 0;
  add('stone', stone);
  S.made.stone = (S.made.stone || 0) + stone;
  if (crystal) { add('crystal', 1); S.made.crystal = (S.made.crystal || 0) + 1; }
  S.cave[i] = t + CAVE_REGROW_MS;
  gainXP(8);
  emit('crystalBroken', { i, stone, crystal });
  if (rand() < CAVE_GEM) gainGems(1, 'cave');
  return 'done';
}
