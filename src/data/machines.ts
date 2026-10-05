import type { GoodId, ItemId } from './goods';

export type MachineId = 'bakery' | 'popper' | 'juicer' | 'cannery' | 'oven';

export interface Machine {
  name: string;
  in: Partial<Record<ItemId, number>>;
  out: GoodId;
  /** Base production time in seconds. */
  time: number;
  cost: number;
  lvl: number;
  wall: string;
  roof: string;
}

export const MACHINES: Record<MachineId, Machine> = {
  bakery:  { name: 'Bakery',      in: { wheat: 3 },                 out: 'bread',   time: 8,  cost: 120,  lvl: 2, wall: '#efc27d', roof: '#a8642c' },
  popper:  { name: 'Popcorn Pot', in: { corn: 2 },                  out: 'popcorn', time: 10, cost: 350,  lvl: 3, wall: '#f6dc6a', roof: '#c2412f' },
  juicer:  { name: 'Juicer',      in: { carrot: 3 },                out: 'juice',   time: 14, cost: 900,  lvl: 4, wall: '#f3a24c', roof: '#5d7f34' },
  cannery: { name: 'Cannery',     in: { tomato: 3 },                out: 'sauce',   time: 18, cost: 2200, lvl: 6, wall: '#e3ddcf', roof: '#9a3b2b' },
  oven:    { name: 'Cake Oven',   in: { strawberry: 2, bread: 1 },  out: 'cake',    time: 24, cost: 5000, lvl: 8, wall: '#f2b3c4', roof: '#7a4a8c' },
};

export const MACHINE_IDS = Object.keys(MACHINES) as MachineId[];

export const recipe = (id: MachineId) => Object.entries(MACHINES[id].in) as [ItemId, number][];
