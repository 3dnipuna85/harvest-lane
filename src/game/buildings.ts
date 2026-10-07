import { BUILDINGS, type BuildingId } from '../data/buildings';
import type { ItemId } from '../data/goods';
import { inv } from './economy';
import { emit } from './events';
import { S } from './state';

/** Building upgrades (data/buildings.ts). The perks themselves are applied where they act: economy.ts and animals.ts. */

export const buildLvl = (k: BuildingId) => S.build[k] || 0;
export const nextStep = (k: BuildingId) => BUILDINGS[k].steps[buildLvl(k)];

export type BuildResult = { ok: true; lvl: number } | { ok: false; reason: 'max' | 'locked' | 'coins' | 'gems' | 'mats'; lvl?: number };

/** Materials still missing for a building's next step. */
export function buildShort(k: BuildingId) {
  const n = nextStep(k);
  return n ? (Object.entries(n.mats) as [ItemId, number][]).filter(([i, q]) => inv(i) < q) : [];
}

export function upgradeBuilding(k: BuildingId): BuildResult {
  const n = nextStep(k);
  if (!n) return { ok: false, reason: 'max' };
  if (S.level < n.lvl) return { ok: false, reason: 'locked', lvl: n.lvl };
  if (S.coins < n.coins) return { ok: false, reason: 'coins' };
  if (S.gems < n.gems) return { ok: false, reason: 'gems' };
  if (buildShort(k).length) return { ok: false, reason: 'mats' };
  for (const [i, q] of Object.entries(n.mats) as [ItemId, number][]) S.inv[i] = inv(i) - q;
  S.coins -= n.coins;
  S.gems -= n.gems;
  S.build[k] = buildLvl(k) + 1;
  emit('buildingUp', { k, lvl: S.build[k] });
  return { ok: true, lvl: S.build[k] };
}
