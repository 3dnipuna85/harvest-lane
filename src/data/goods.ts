import { CROPS, type CropId } from './crops';

export type GoodId = 'bread' | 'popcorn' | 'juice' | 'sauce' | 'cake';
export type ItemId = CropId | GoodId;

export interface Good {
  name: string;
  icon: string;
  sell: number;
}

export const GOODS: Record<GoodId, Good> = {
  bread:   { name: 'Bread',           icon: '🍞', sell: 22 },
  popcorn: { name: 'Popcorn',         icon: '🍿', sell: 38 },
  juice:   { name: 'Carrot Juice',    icon: '🧃', sell: 72 },
  sauce:   { name: 'Tomato Sauce',    icon: '🥫', sell: 120 },
  cake:    { name: 'Strawberry Cake', icon: '🍰', sell: 260 },
};

export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

/** Every item that can sit in the barn: crops first, then goods. */
export const ITEMS: Record<ItemId, Good> = { ...CROPS, ...GOODS };
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
