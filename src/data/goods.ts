import { CROPS, type CropId } from './crops';

export type GoodId = 'bread' | 'popcorn' | 'juice' | 'sauce' | 'cake';
/** Things animals give: collected from the pen and the yard, not made in a workshop. */
export type ProductId = 'egg' | 'milk' | 'truffle' | 'wool' | 'fish' | 'crab' | 'goldfish';
export type ItemId = CropId | GoodId | ProductId;

export interface Good {
  name: string;
  icon: string;
  sell: number;
}

export const GOODS: Record<GoodId, Good> = {
  bread:   { name: 'Bread',           icon: '🍞', sell: 30 },
  popcorn: { name: 'Popcorn',         icon: '🍿', sell: 52 },
  juice:   { name: 'Carrot Juice',    icon: '🧃', sell: 120 },
  sauce:   { name: 'Tomato Sauce',    icon: '🥫', sell: 195 },
  cake:    { name: 'Strawberry Cake', icon: '🍰', sell: 300 },
};

export const GOOD_IDS = Object.keys(GOODS) as GoodId[];

export const PRODUCTS: Record<ProductId, Good> = {
  egg:     { name: 'Egg',     icon: '🥚', sell: 8 },
  milk:    { name: 'Milk',    icon: '🥛', sell: 26 },
  truffle: { name: 'Truffle', icon: '🍄', sell: 55 },
  wool:    { name: 'Wool',    icon: '🧶', sell: 48 },
  fish:    { name: 'Fish',    icon: '🐟', sell: 14 },
  crab:    { name: 'Crab',    icon: '🦀', sell: 34 },
  goldfish: { name: 'Golden Fish', icon: '🐠', sell: 150 },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS) as ProductId[];

/** Every item that can sit in the barn: crops, then animal products, then goods. */
export const ITEMS: Record<ItemId, Good> = { ...CROPS, ...PRODUCTS, ...GOODS };
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
