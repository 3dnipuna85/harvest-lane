/**
 * Farm tiers: the farm itself grows up. Each tier caps the player's level; to level past the cap you upgrade the
 * farm with coins and diamonds (earned from shop sales, contract trucks and level-ups). Each upgrade dresses up
 * the farm and makes trucks pay a little more.
 */
export interface FarmTier {
  name: string;
  /** Highest level reachable on this tier. */
  cap: number;
  /** Price to upgrade INTO this tier. */
  coins: number;
  gems: number;
  /** What the upgrade adds to the farm, for the upgrade card. */
  adds: string;
}

export const TIERS: FarmTier[] = [
  { name: 'Homestead',    cap: 10,       coins: 0,      gems: 0,   adds: '' },
  { name: 'Country Farm', cap: 18,       coins: 8000,   gems: 8,   adds: 'a picket fence and rose arch for the farmhouse' },
  { name: 'Ranch',        cap: 26,       coins: 40000,  gems: 25,  adds: 'lamp posts, hay bales and a dovecote' },
  { name: 'Estate',       cap: 35,       coins: 150000, gems: 60,  adds: 'a stone fountain and clipped hedges' },
  { name: 'Grand Estate', cap: Infinity, coins: 500000, gems: 150, adds: 'golden flags and a golden rooster on the roof' },
];

/** Trucks pay this much more for every farm tier. */
export const TIER_PAY = 0.05;
