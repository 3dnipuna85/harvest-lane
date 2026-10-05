import { TIERS } from '../data/tiers';
import { gainXP } from './economy';
import { emit } from './events';
import { S } from './state';

/** Diamonds and farm tiers (data/tiers.ts). */

export const tierOf = () => TIERS[S.tier];
export const nextTier = () => TIERS[S.tier + 1];
export const levelCap = () => tierOf().cap;
/** At the level cap with a full XP bar: only a farm upgrade lets the player level again. */
export const capped = () => S.level >= levelCap();

/** Award diamonds. */
export function gainGems(n: number, why: string) {
  if (n <= 0) return;
  S.gems += n;
  emit('gems', { n, why });
}

/** A chance at one diamond. */
export const gemChance = (p: number, why: string, rand = Math.random) => { if (rand() < p) gainGems(1, why); };

export type UpgradeResult = { ok: true; tier: number } | { ok: false; reason: 'max' | 'coins' | 'gems' };

export function upgradeFarm(): UpgradeResult {
  const n = nextTier();
  if (!n) return { ok: false, reason: 'max' };
  if (S.coins < n.coins) return { ok: false, reason: 'coins' };
  if (S.gems < n.gems) return { ok: false, reason: 'gems' };
  S.coins -= n.coins;
  S.gems -= n.gems;
  S.tier++;
  emit('farmUpgrade', { tier: S.tier });
  // XP saved up at the old cap counts straight away.
  gainXP(0);
  return { ok: true, tier: S.tier };
}
