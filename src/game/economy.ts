import { CROPS, CROP_IDS, DOUBLE_HARVEST_CHANCE, type CropId } from '../data/crops';
import { GOODS, ITEMS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS, type MachineId } from '../data/machines';
import { MAX_FARMHANDS, MAX_MACHINE_LEVEL, MAX_PLOTS, MAX_SELLERS, START_PLOTS } from '../data/limits';
import { now } from './clock';
import { emit } from './events';
import { S, type Plot } from './state';

export const xpNeed = (l: number) => Math.round(14 * Math.pow(l, 1.55));
export const plotCost = () => Math.round(40 * Math.pow(1.5, S.plots.length - START_PLOTS));
export const farmhandCost = () => Math.round(80 * Math.pow(1.8, S.farmhands));
export const sellerCost = () => Math.round(150 * Math.pow(1.9, S.sellers));
/** Production time in seconds; each upgrade level is 18% faster. */
export const mTime = (k: MachineId) => MACHINES[k].time * Math.pow(0.82, S.machines[k].lvl - 1);
export const mUpCost = (k: MachineId) => Math.round(MACHINES[k].cost * 0.6 * S.machines[k].lvl);
export const inv = (k: ItemId) => S.inv[k] || 0;
export const add = (k: ItemId, n: number) => { S.inv[k] = inv(k) + n; };
export const totalItems = () => (Object.keys(ITEMS) as ItemId[]).reduce((a, k) => a + inv(k), 0);
export const growProgress = (p: Plot) => (p.crop ? Math.min(1, (now() - p.at) / (CROPS[p.crop].time * 1000)) : 0);
export const ripe = (p: Plot) => !!p.crop && now() >= p.at + CROPS[p.crop].time * 1000;
export const unlockedCrops = () => CROP_IDS.filter(k => CROPS[k].lvl <= S.level);

export function gainXP(n: number) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    const unlocked: string[] = [];
    for (const k of CROP_IDS) if (CROPS[k].lvl === S.level) unlocked.push(CROPS[k].icon + ' ' + CROPS[k].name + ' seeds');
    for (const k of MACHINE_IDS) if (MACHINES[k].lvl === S.level) unlocked.push(MACHINES[k].name);
    if (S.level === 2) unlocked.push('Farmhands');
    if (S.level === 3) unlocked.push('Market sellers');
    emit('levelUp', { level: S.level, unlocked });
  }
}

export function earn(n: number) {
  S.coins += n;
  S.stats.earned += n;
  emit('earn', { amount: n });
}

/** Plant the selected seed on plot i. Returns false if the player cannot afford it. */
/** Plant `crop` (the seed selected when the plot was tapped; defaults to the current selection). */
export function plant(i: number, crop: CropId = S.sel): boolean {
  const p = S.plots[i], c = CROPS[crop];
  if (!p || S.coins < c.seed) return false;
  S.coins -= c.seed;
  p.crop = crop;
  p.at = now();
  emit('plant', { i, crop });
  return true;
}

export function harvest(i: number, rand = Math.random): number {
  const p = S.plots[i];
  if (!p || !p.crop) return 0;
  const crop = p.crop, n = rand() < DOUBLE_HARVEST_CHANCE ? 2 : 1;
  add(crop, n);
  S.stats.harvested += n;
  gainXP(CROPS[crop].xp * n);
  p.crop = null;
  p.at = 0;
  emit('harvest', { i, crop, n });
  return n;
}

/** Sell up to n of an item. Returns the coins earned. */
export function sell(k: ItemId, n: number): number {
  n = Math.min(n, inv(k));
  if (n <= 0) return 0;
  S.inv[k] = inv(k) - n;
  const g = n * ITEMS[k].sell;
  earn(g);
  return g;
}

export type BuyResult = { ok: true } | { ok: false; reason: 'max' | 'coins' | 'locked'; cost?: number };

export function buyPlot(): BuyResult {
  const c = plotCost();
  if (S.plots.length >= MAX_PLOTS) return { ok: false, reason: 'max' };
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.plots.push({ crop: null, at: 0 });
  return { ok: true };
}

export function buyMachine(k: MachineId): BuyResult {
  const d = MACHINES[k];
  if (d.lvl > S.level) return { ok: false, reason: 'locked' };
  if (S.machines[k].owned) return { ok: false, reason: 'max' };
  if (S.coins < d.cost) return { ok: false, reason: 'coins', cost: d.cost };
  S.coins -= d.cost;
  S.machines[k].owned = true;
  return { ok: true };
}

export function upgradeMachine(k: MachineId): BuyResult {
  const c = mUpCost(k);
  if (S.machines[k].lvl >= MAX_MACHINE_LEVEL) return { ok: false, reason: 'max' };
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.machines[k].lvl++;
  return { ok: true };
}

export function hire(kind: 'farmhand' | 'seller'): BuyResult {
  if (kind === 'farmhand') {
    const c = farmhandCost();
    if (S.level < 2) return { ok: false, reason: 'locked' };
    if (S.farmhands >= MAX_FARMHANDS) return { ok: false, reason: 'max' };
    if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
    S.coins -= c; S.farmhands++;
  } else {
    const c = sellerCost();
    if (S.level < 3) return { ok: false, reason: 'locked' };
    if (S.sellers >= MAX_SELLERS) return { ok: false, reason: 'max' };
    if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
    S.coins -= c; S.sellers++;
  }
  return { ok: true };
}

/** XP for finishing one workshop product. */
export const goodXP = (k: keyof typeof GOODS) => Math.max(2, Math.round(GOODS[k].sell / 10));
