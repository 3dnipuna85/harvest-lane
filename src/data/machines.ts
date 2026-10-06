import type { GoodId, ItemId } from './goods';

export type MachineId = 'bakery' | 'popper' | 'juicer' | 'cannery' | 'oven' | 'sawmill' | 'mason' | 'dairy' | 'apiary';

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
  /** Where it stands, for workshops beyond the first row (the first five sit beside the barn). */
  at?: { x: number; z: number };
}

export const MACHINES: Record<MachineId, Machine> = {
  bakery:  { name: 'Bakery',      in: { wheat: 3 },                 out: 'bread',   time: 8,  cost: 120,  lvl: 2, wall: '#efc27d', roof: '#a8642c' },
  popper:  { name: 'Popcorn Pot', in: { corn: 2 },                  out: 'popcorn', time: 10, cost: 350,  lvl: 3, wall: '#f6dc6a', roof: '#c2412f' },
  juicer:  { name: 'Juicer',      in: { carrot: 3 },                out: 'juice',   time: 14, cost: 900,  lvl: 4, wall: '#f3a24c', roof: '#5d7f34' },
  cannery: { name: 'Cannery',     in: { tomato: 3 },                out: 'sauce',   time: 18, cost: 2200, lvl: 6, wall: '#e3ddcf', roof: '#9a3b2b' },
  oven:    { name: 'Cake Oven',   in: { strawberry: 2, bread: 1 },  out: 'cake',    time: 24, cost: 5000, lvl: 8, wall: '#f2b3c4', roof: '#7a4a8c' },
  // The back row, beyond the north fence by the Woods and the Quarry.
  sawmill: { name: 'Sawmill',     in: { log: 2 },                   out: 'plank',   time: 20, cost: 4000,  lvl: 9,  wall: '#c98f55', roof: '#5d7f34', at: { x: -3.6, z: -12.6 } },
  mason:   { name: 'Stonecutter', in: { stone: 2 },                 out: 'brick',   time: 26, cost: 7000,  lvl: 11, wall: '#cfc8b8', roof: '#8a4a3a', at: { x: 6.6, z: -12.6 } },
  dairy:   { name: 'Dairy',       in: { milk: 3 },                  out: 'cheese',  time: 30, cost: 9000,  lvl: 12, wall: '#f4f1ea', roof: '#3a7dc4', at: { x: -0.1, z: -12.6 } },
  apiary:  { name: 'Apiary',      in: { strawberry: 3 },            out: 'honey',   time: 34, cost: 14000, lvl: 14, wall: '#f6dc6a', roof: '#a8642c', at: { x: 3.3, z: -12.6 } },
};

export const MACHINE_IDS = Object.keys(MACHINES) as MachineId[];

export const recipe = (id: MachineId) => Object.entries(MACHINES[id].in) as [ItemId, number][];
