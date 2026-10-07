import { CROPS } from '../data/crops';
import { FLEET_EVERY_MS, TECH, TECH_IDS, type TechId } from '../data/tech';
import type { ItemId } from '../data/goods';
import { byStaff, harvest, inv, plant, ripe } from './economy';
import { emit } from './events';
import { S } from './state';

/** Farm technology (data/tech.ts): bought in order, once each. */

export const hasTech = (k: TechId) => S.tech.includes(k);
/** The next machine to buy, if any. */
export const nextTech = () => TECH_IDS.find(k => !hasTech(k));

export type TechResult = { ok: true } | { ok: false; reason: 'owned' | 'order' | 'locked' | 'coins' | 'gems' | 'mats'; lvl?: number };

export function techShort(k: TechId) {
  return (Object.entries(TECH[k].mats) as [ItemId, number][]).filter(([i, q]) => inv(i) < q);
}

export function buyTech(k: TechId): TechResult {
  const d = TECH[k];
  if (hasTech(k)) return { ok: false, reason: 'owned' };
  if (nextTech() !== k) return { ok: false, reason: 'order' };
  if (S.level < d.lvl) return { ok: false, reason: 'locked', lvl: d.lvl };
  if (S.coins < d.coins) return { ok: false, reason: 'coins' };
  if (S.gems < d.gems) return { ok: false, reason: 'gems' };
  if (techShort(k).length) return { ok: false, reason: 'mats' };
  for (const [i, q] of Object.entries(d.mats) as [ItemId, number][]) S.inv[i] = inv(i) - q;
  S.coins -= d.coins;
  S.gems -= d.gems;
  S.tech.push(k);
  emit('techBought', { k });
  return { ok: true };
}


/** Tractor: sow the selected seed on every empty plot the player can pay for. Returns how many were sown. */
export function sowAll() {
  if (!hasTech('tractor')) return 0;
  let n = 0;
  S.plots.forEach((p, i) => { if (!p.crop && S.coins >= CROPS[S.sel].seed && plant(i)) n++; });
  if (n) emit('machineRun', { k: 'tractor', n });
  return n;
}

/** Combine harvester: harvest every ripe plot (the player's own work, so it earns XP). */
export function harvestAll() {
  if (!hasTech('harvester')) return 0;
  let n = 0;
  S.plots.forEach((p, i) => { if (p.crop && ripe(p)) n += harvest(i); });
  if (n) emit('machineRun', { k: 'harvester', n });
  return n;
}

let fleetAt = 0;
/** Drone fleet: every so often, pick one ripe plot and replant it (like staff: coins, no XP). Called from the sim. */
export function fleetTick(t: number) {
  if (!hasTech('fleet') || t - fleetAt < FLEET_EVERY_MS) return;
  fleetAt = t;
  const i = S.plots.findIndex(p => p.crop && ripe(p));
  if (i < 0) return;
  byStaff(() => { harvest(i); if (S.coins >= CROPS[S.sel].seed) plant(i); });
}
