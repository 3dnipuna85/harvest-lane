/** Land beyond the farm fence, bought in order once the home field is full. Each parcel comes with a field of plots. */
export interface Parcel {
  id: string;
  name: string;
  cost: number;
  lvl: number;
  /** East (+1) or west (-1) of the farm. */
  side: 1 | -1;
}

export const LAND: Parcel[] = [
  { id: 'east', name: 'East Meadow', cost: 6000, lvl: 6, side: 1 },
  { id: 'west', name: 'West Hollow', cost: 20000, lvl: 10, side: -1 },
];

/** Plots in each parcel: 3 columns by 4 rows, lined up with the home field's rows. */
export const PARCEL_COLS = 3;
export const PARCEL_ROWS = 4;
export const PARCEL_PLOTS = PARCEL_COLS * PARCEL_ROWS;
