import type { ItemId } from './goods';
import { MAX_PLOTS } from './limits';

/** Land beyond the farm fence, bought in order once the home field is full. Each parcel comes with a field of plots. */
export interface Parcel {
  id: string;
  name: string;
  cost: number;
  lvl: number;
  /** East (+1) or west (-1) of the farm. */
  side: 1 | -1;
  /** Building materials for the fences and paths. */
  mats: Partial<Record<ItemId, number>>;
}

export const LAND: Parcel[] = [
  { id: 'east', name: 'East Meadow', cost: 6000, lvl: 10, side: 1, mats: { plank: 20 } },
  { id: 'west', name: 'West Hollow', cost: 20000, lvl: 14, side: -1, mats: { plank: 40, brick: 25 } },
];

/** Once all the land is yours, a riverside row can be added to each parcel, one plot at a time (east first). */
export const RIVER_PLOTS: { lvl: number; cost: number; mats: Partial<Record<ItemId, number>> }[] = [
  { lvl: 17, cost: 8000, mats: { plank: 15, brick: 10 } }, { lvl: 17, cost: 10000, mats: { plank: 15, brick: 10 } }, { lvl: 17, cost: 12000, mats: { plank: 15, brick: 10 } },
  { lvl: 21, cost: 15000, mats: { plank: 15, brick: 10 } }, { lvl: 21, cost: 18000, mats: { plank: 15, brick: 10 } }, { lvl: 21, cost: 22000, mats: { plank: 15, brick: 10 } },
];

/** Plots in each parcel: 3 columns by 4 rows, lined up with the home field's rows. */
export const PARCEL_COLS = 3;
export const PARCEL_ROWS = 4;
export const PARCEL_PLOTS = PARCEL_COLS * PARCEL_ROWS;

/** Index of the first riverside plot: after the home field and every land parcel. */
export const RIVER0 = MAX_PLOTS + PARCEL_PLOTS * LAND.length;
