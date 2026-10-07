import type { ItemId } from './goods';

/**
 * Farm buildings the player can upgrade one by one, from the Farm Upgrades panel. Each level costs coins, and the
 * later ones building materials and diamonds; each adds something to the building on the farm and a lasting perk.
 */
export type BuildingId = 'barn' | 'pens' | 'house';

export interface BuildStep {
  /** Player level needed for this step. */
  lvl: number;
  coins: number;
  gems: number;
  mats: Partial<Record<ItemId, number>>;
  /** What the step adds to the building, for the card. */
  adds: string;
}

export interface Building { name: string; icon: string; perk: string; steps: BuildStep[] }

/** Barn: everything sold at the farm gate, the cart and the town shop pays this much more per level. */
export const BARN_PAY = 0.05;
/** Animal pens: products are ready this much sooner per level (compounding). */
export const PEN_SPEED = 0.15;
/** Farmhouse: the player's own work earns this much more XP per level. */
export const HOUSE_XP = 0.05;

export const BUILDINGS: Record<BuildingId, Building> = {
  barn: {
    name: 'Barn', icon: '📦', perk: 'Goods keep fresher, so everything you sell pays 5% more per level.',
    steps: [
      { lvl: 6, coins: 3000, gems: 0, mats: {}, adds: 'a grain silo' },
      { lvl: 12, coins: 18000, gems: 10, mats: { plank: 20, brick: 10 }, adds: 'a second silo' },
      { lvl: 19, coins: 70000, gems: 30, mats: { plank: 40, brick: 30 }, adds: 'a cold store with a blue roof' },
    ],
  },
  pens: {
    name: 'Animal Pens', icon: '🐄', perk: 'Comfier animals make their goods 15% faster per level.',
    steps: [
      { lvl: 5, coins: 2000, gems: 0, mats: {}, adds: 'a shelter roof over the pen' },
      { lvl: 11, coins: 12000, gems: 8, mats: { plank: 25 }, adds: 'water troughs and fresh straw' },
      { lvl: 17, coins: 50000, gems: 25, mats: { plank: 30, brick: 25 }, adds: 'an automatic feeder' },
    ],
  },
  house: {
    name: 'Farmhouse', icon: '🏡', perk: 'A well-rested farmer learns faster: your own work earns 5% more XP per level.',
    steps: [
      { lvl: 8, coins: 6000, gems: 3, mats: {}, adds: 'a covered porch with a bench' },
      { lvl: 15, coins: 30000, gems: 15, mats: { plank: 35, brick: 20 }, adds: 'a new wing' },
      { lvl: 22, coins: 120000, gems: 40, mats: { plank: 60, brick: 50, cheese: 10 }, adds: 'solar panels and a greenhouse' },
    ],
  },
};

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const MAX_BUILD = 3;
