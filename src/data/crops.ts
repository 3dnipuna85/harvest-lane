export type CropId = 'wheat' | 'corn' | 'carrot' | 'tomato' | 'strawberry';

export interface Crop {
  name: string;
  icon: string;
  /** Seed cost in coins. */
  seed: number;
  /** Grow time in seconds. */
  time: number;
  sell: number;
  /** Player level that unlocks the seed. */
  lvl: number;
  xp: number;
}

export const CROPS: Record<CropId, Crop> = {
  wheat:      { name: 'Wheat',      icon: '🌾', seed: 2,  time: 6,  sell: 4,  lvl: 1, xp: 1 },
  corn:       { name: 'Corn',       icon: '🌽', seed: 6,  time: 12, sell: 11, lvl: 2, xp: 2 },
  carrot:     { name: 'Carrot',     icon: '🥕', seed: 10, time: 18, sell: 18, lvl: 3, xp: 3 },
  tomato:     { name: 'Tomato',     icon: '🍅', seed: 16, time: 28, sell: 30, lvl: 5, xp: 5 },
  strawberry: { name: 'Strawberry', icon: '🍓', seed: 26, time: 40, sell: 50, lvl: 7, xp: 7 },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** Chance that a harvest yields double. */
export const DOUBLE_HARVEST_CHANCE = 0.15;
