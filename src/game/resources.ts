import { now } from './clock';
import { add, gainXP, hands } from './economy';
import { gemChance } from './estate';
import { emit } from './events';
import { S } from './state';

/**
 * The Woods and the Quarry, north of the farm, and the bigger areas found later: Pine Ridge (more trees) and Hill
 * Quarry (harder rock, more stone, the odd diamond). Tap a tree to chop it (3 chops fells it for logs) or a rock to
 * break it. A felled tree leaves a stump: plant a sapling on it and a new tree grows. Broken rocks are dug out again.
 */
export const WOODS_LVL = 9, QUARRY_LVL = 11, RIDGE_LVL = 16, HILL_LVL = 18;
/** The first 10 trees are the Woods, the rest Pine Ridge; the first 8 rocks the Quarry, the rest Hill Quarry. */
export const WOODS_TREES = 10, RIDGE_TREES = 6, QUARRY_ROCKS = 8, HILL_ROCKS = 6;
export const TREES = WOODS_TREES + RIDGE_TREES, ROCKS = QUARRY_ROCKS + HILL_ROCKS;
export const CHOPS = 3, HITS = 4, HILL_HITS = 5;
export const TREE_REGROW_MS = 4 * 60_000, ROCK_REGROW_MS = 5 * 60_000;
/** A felled tree's stump stays until a sapling is planted (S.woods holds this instead of a regrow time). */
export const STUMP = Number.MAX_SAFE_INTEGER;
export const saplingCost = (level = S.level) => 15 + 2 * level;
export const HILL_GEM = 0.08;

export const treeLvl = (i: number) => (i < WOODS_TREES ? WOODS_LVL : RIDGE_LVL);
export const rockLvl = (i: number) => (i < QUARRY_ROCKS ? QUARRY_LVL : HILL_LVL);
export const hitsFor = (i: number) => (i < QUARRY_ROCKS ? HITS : HILL_HITS);
export const treeOpen = (i: number) => S.level >= treeLvl(i);
export const rockOpen = (i: number) => S.level >= rockLvl(i);

const chops = new Map<number, number>(), hits = new Map<number, number>();
export const chopsOn = (i: number) => chops.get(i) || 0;
export const hitsOn = (i: number) => hits.get(i) || 0;
export const treeUp = (i: number, t = now()) => treeOpen(i) && (S.woods[i] || 0) <= t;
export const rockUp = (i: number, t = now()) => rockOpen(i) && (S.rocks[i] || 0) <= t;
export const isStump = (i: number) => S.woods[i] === STUMP;

export type WorkResult = 'locked' | 'regrowing' | 'stump' | 'hit' | 'done';

export function chopTree(i: number, t = now(), rand = Math.random): WorkResult {
  if (!treeOpen(i)) return 'locked';
  if (isStump(i)) return 'stump';
  if (!treeUp(i, t)) return 'regrowing';
  const n = chopsOn(i) + 1;
  if (n < CHOPS) { chops.set(i, n); emit('treeChop', { i }); return 'hit'; }
  chops.delete(i);
  const logs = 2 + (rand() < 0.25 ? 1 : 0);
  add('log', logs);
  S.made.log = (S.made.log || 0) + logs;
  S.woods[i] = STUMP;
  gainXP(3);
  emit('treeFelled', { i, n: logs });
  return 'done';
}

export type PlantResult = { ok: true } | { ok: false; reason: 'locked' | 'notstump' | 'coins'; cost?: number };
/** Plant a sapling on a stump: a new tree grows in TREE_REGROW_MS. */
export function plantSapling(i: number, t = now()): PlantResult {
  if (!treeOpen(i)) return { ok: false, reason: 'locked' };
  if (!isStump(i)) return { ok: false, reason: 'notstump' };
  const c = saplingCost();
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.woods[i] = t + TREE_REGROW_MS;
  if (!hands.staff) gainXP(1);
  emit('saplingPlanted', { i });
  return { ok: true };
}

export function mineRock(i: number, t = now(), rand = Math.random): WorkResult {
  if (!rockOpen(i)) return 'locked';
  if (!rockUp(i, t)) return 'regrowing';
  const n = hitsOn(i) + 1;
  if (n < hitsFor(i)) { hits.set(i, n); emit('rockHit', { i }); return 'hit'; }
  hits.delete(i);
  const hill = i >= QUARRY_ROCKS;
  const stone = (hill ? 3 : 2) + (rand() < 0.25 ? 1 : 0);
  add('stone', stone);
  S.made.stone = (S.made.stone || 0) + stone;
  S.rocks[i] = t + ROCK_REGROW_MS;
  gainXP(hill ? 6 : 4);
  emit('rockBroken', { i, n: stone });
  if (hill) gemChance(HILL_GEM, 'hill', rand);
  return 'done';
}
