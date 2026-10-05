import type { CropId } from './crops';
import type { ProductId } from './goods';

export type AnimalId = 'hen' | 'cow' | 'pig' | 'sheep';

export interface Animal {
  name: string;
  plural: string;
  icon: string;
  /** What it eats, and how much per meal. */
  feed: CropId;
  feedQty: number;
  product: ProductId;
  /** Seconds from feeding until the product is ready. */
  time: number;
  /** Player level that unlocks it. */
  lvl: number;
  /** How many the farm starts with once unlocked, the most it can hold, and the price of the first extra one. */
  start: number;
  max: number;
  cost: number;
  xp: number;
}

export const ANIMALS: Record<AnimalId, Animal> = {
  hen:   { name: 'Hen',   plural: 'Hens',  icon: '🐔', feed: 'wheat',  feedQty: 1, product: 'egg',     time: 20, lvl: 1, start: 3, max: 6, cost: 60,   xp: 1 },
  cow:   { name: 'Cow',   plural: 'Cows',  icon: '🐄', feed: 'corn',   feedQty: 2, product: 'milk',    time: 35, lvl: 2, start: 2, max: 4, cost: 300,  xp: 3 },
  pig:   { name: 'Pig',   plural: 'Pigs',  icon: '🐖', feed: 'carrot', feedQty: 2, product: 'truffle', time: 50, lvl: 4, start: 1, max: 3, cost: 700,  xp: 5 },
  sheep: { name: 'Sheep', plural: 'Sheep', icon: '🐑', feed: 'corn',   feedQty: 3, product: 'wool',    time: 45, lvl: 5, start: 0, max: 4, cost: 900,  xp: 5 },
};

export const ANIMAL_IDS = Object.keys(ANIMALS) as AnimalId[];
