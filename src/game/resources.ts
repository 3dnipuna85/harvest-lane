import { now } from './clock';
import { add, gainXP } from './economy';
import { emit } from './events';
import { S } from './state';

/**
 * The Woods and the Quarry, north of the farm. Tap a tree to chop it (3 chops fells it for logs, and the stump
 * regrows) or a rock to break it (4 hits for stone, and a new rock is uncovered later). Hard work, by hand.
 */
export const TREES = 10, ROCKS = 8;
export const WOODS_LVL = 9, QUARRY_LVL = 11;
export const CHOPS = 3, HITS = 4;
export const TREE_REGROW_MS = 4 * 60_000, ROCK_REGROW_MS = 5 * 60_000;

const chops = new Map<number, number>(), hits = new Map<number, number>();
export const chopsOn = (i: number) => chops.get(i) || 0;
export const hitsOn = (i: number) => hits.get(i) || 0;
export const treeUp = (i: number, t = now()) => (S.woods[i] || 0) <= t;
export const rockUp = (i: number, t = now()) => (S.rocks[i] || 0) <= t;

export type WorkResult = 'locked' | 'regrowing' | 'hit' | 'done';

export function chopTree(i: number, t = now(), rand = Math.random): WorkResult {
  if (S.level < WOODS_LVL) return 'locked';
  if (!treeUp(i, t)) return 'regrowing';
  const n = chopsOn(i) + 1;
  if (n < CHOPS) { chops.set(i, n); emit('treeChop', { i }); return 'hit'; }
  chops.delete(i);
  const logs = 2 + (rand() < 0.25 ? 1 : 0);
  add('log', logs);
  S.made.log = (S.made.log || 0) + logs;
  S.woods[i] = t + TREE_REGROW_MS;
  gainXP(3);
  emit('treeFelled', { i, n: logs });
  return 'done';
}

export function mineRock(i: number, t = now(), rand = Math.random): WorkResult {
  if (S.level < QUARRY_LVL) return 'locked';
  if (!rockUp(i, t)) return 'regrowing';
  const n = hitsOn(i) + 1;
  if (n < HITS) { hits.set(i, n); emit('rockHit', { i }); return 'hit'; }
  hits.delete(i);
  const stone = 2 + (rand() < 0.25 ? 1 : 0);
  add('stone', stone);
  S.made.stone = (S.made.stone || 0) + stone;
  S.rocks[i] = t + ROCK_REGROW_MS;
  gainXP(4);
  emit('rockBroken', { i, n: stone });
  return 'done';
}
