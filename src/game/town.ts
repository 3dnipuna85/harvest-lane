import { ANIMALS, type AnimalId } from '../data/animals';
import { GOOD_IDS, MATERIALS, PRODUCT_IDS, type ItemId } from '../data/goods';
import { now } from './clock';
import { earn, flood, inv, unitPrice, type BuyResult } from './economy';
import { emit } from './events';
import { gainGems } from './estate';
import { S } from './state';

/**
 * Market Town: a second map reached by road. The Animal Market sells animals and bigger pens, the General Store
 * sells fertilizer, and the player can buy a shop of their own where a hired shopkeeper sells goods at town prices.
 */

export const SHOP_COST = 25000;
export const SHOP_LVL = 8;
/** Town shoppers pay this much more than the farm-gate price. */
export const SHOP_MARKUP = 1.5;
/** The shopkeeper sells one item this often. */
export const SHOP_EVERY_MS = 4000;
/** Chance of a diamond with each shop sale. */
export const SHOP_GEM = 0.05;
export const SHOP_GEM_GAP_MS = 10 * 60_000;

/** Each pen upgrade lets you keep 2 more of every animal. */
export const PEN_STEP = 2;
export const MAX_PEN = 3;
export const penCost = () => 2000 * Math.pow(S.town.pen + 1, 2);
export const maxAnimals = (k: AnimalId) => ANIMALS[k].max + PEN_STEP * S.town.pen;

/** Fertilizer: everything planted while it lasts grows 25% faster. */
export const BOOST_MIN = 30;
export const BOOST_SPEED = 0.25;
export const boostCost = () => 150 + 40 * S.level;
export const boosted = (t = now()) => S.boost > t;

export function buyPen(): BuyResult {
  if (S.town.pen >= MAX_PEN) return { ok: false, reason: 'max' };
  const c = penCost();
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.town.pen++;
  return { ok: true };
}

export function buyBoost(t = now()): BuyResult {
  const c = boostCost();
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.boost = Math.max(t, S.boost) + BOOST_MIN * 60_000;
  return { ok: true };
}

export function buyShop(): BuyResult {
  if (S.town.shop) return { ok: false, reason: 'max' };
  if (S.level < SHOP_LVL) return { ok: false, reason: 'locked' };
  if (S.coins < SHOP_COST) return { ok: false, reason: 'coins', cost: SHOP_COST };
  S.coins -= SHOP_COST;
  S.town.shop = true;
  return { ok: true };
}

/** What the waiting truck and the next one want. Trucks come first, so the shop never sells these. */
export function truckReserve(): Partial<Record<ItemId, number>> {
  const r: Partial<Record<ItemId, number>> = {};
  for (const w of [S.truck?.items, S.nextWants, S.contract?.items]) if (w) for (const [k, q] of Object.entries(w) as [ItemId, number][]) r[k] = (r[k] || 0) + q;
  return r;
}

/** The most valuable good or animal product in the barn that no truck needs, for the shopkeeper to sell. */
export function shopItem(): ItemId | undefined {
  const keep = truckReserve();
  return [...GOOD_IDS, ...PRODUCT_IDS].filter(k => !MATERIALS.includes(k) && inv(k) > (keep[k] || 0)).sort((a, b) => unitPrice(b) - unitPrice(a))[0];
}

/** One shop sale at town prices. Returns the coins taken. */
export function shopSale(): number {
  const k = shopItem();
  if (!k) return 0;
  S.inv[k] = inv(k) - 1;
  const coins = Math.round(unitPrice(k) * SHOP_MARKUP);
  flood(k);
  earn(coins);
  S.stats.shop = (S.stats.shop || 0) + coins;
  emit('shopSale', { item: k, coins });
  // At most one shop diamond every 10 minutes, so a long night of selling doesn't shower them.
  if (now() - (S.gemAt || 0) >= SHOP_GEM_GAP_MS && Math.random() < SHOP_GEM) { S.gemAt = now(); gainGems(1, 'shop'); }
  return coins;
}
