import { CUSTOMERS } from '../data/customers';
import { CROPS } from '../data/crops';
import { ITEMS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS } from '../data/machines';
import { ANIMALS, ANIMAL_IDS } from '../data/animals';
import { ORDER_COUNT, SKIP_COOLDOWN_MS } from '../data/limits';
import { now } from './clock';
import { emit } from './events';
import { earn, gainXP, inv, unlockedCrops } from './economy';
import { S, type Order } from './state';

/** Pay for each coin of raw crops versus each coin of things made or raised: buyers want finished goods. */
export const CROP_PAY = 1, MADE_PAY = 1.8;

/** A buyer's coins for a basket: raw crops pay little, goods from machines, animals and the river pay well. */
export function basketValue(items: Order['items'], cropPay: number, madePay: number) {
  let v = 0;
  for (const [k, q] of Object.entries(items) as [ItemId, number][]) v += ITEMS[k].sell * q * (k in CROPS ? cropPay : madePay);
  return v;
}

/**
 * Machines buyers ask for even before you own one: a level after the machine unlocks, bakeries and juice bars in
 * town start ordering its goods. A farm that only sells raw crops soon can't keep its buyers happy.
 */
export const demanded = () => MACHINE_IDS.filter(m => S.level > MACHINES[m].lvl);

function orderPool() {
  const pool: { k: ItemId; crop: boolean }[] = unlockedCrops().map(k => ({ k, crop: true }));
  for (const m of MACHINE_IDS) if (S.machines[m].owned || demanded().includes(m)) pool.push({ k: MACHINES[m].out, crop: false });
  for (const a of ANIMAL_IDS) if (S.level >= ANIMALS[a].lvl && S.animals[a].n > 0 && (S.made[ANIMALS[a].product] || 0) > 0) pool.push({ k: ANIMALS[a].product, crop: false });
  // River catches join the pool once the player has landed one (golden fish are too rare to order).
  for (const k of ['fish', 'crab', 'log', 'stone'] as const) if ((S.made[k] || 0) > 0) pool.push({ k, crop: false });
  return pool;
}

export function newOrder(rand = Math.random): Order {
  const pool = orderPool().sort(() => rand() - 0.5);
  // From level 4 every buyer wants at least one made thing, so it goes first in the basket.
  if (S.level >= 4) { const j = pool.findIndex(p => !p.crop); if (j > 0) pool.unshift(...pool.splice(j, 1)); }
  const kinds = Math.min(pool.length, 1 + (rand() < (S.level >= 3 ? 0.6 : 0.3) ? 1 : 0) + (S.level >= 5 && rand() < 0.3 ? 1 : 0));
  const items: Order['items'] = {};
  for (let j = 0; j < kinds; j++) {
    const it = pool[j];
    items[it.k] = it.crop ? 3 + Math.floor(rand() * (4 + S.level)) : 1 + Math.floor(rand() * 3);
  }
  const value = basketValue(items, 1, 1);
  return {
    id: ++S.orderSeq,
    who: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
    items,
    coins: Math.round(basketValue(items, CROP_PAY, MADE_PAY) + 5),
    xp: Math.max(2, Math.round(value / 6)),
  };
}

export const orderItems = (o: Order) => Object.entries(o.items) as [ItemId, number][];
export const canFill = (o: Order) => orderItems(o).every(([k, q]) => inv(k) >= q);

export function fillOrders() {
  while (S.orders.length < ORDER_COUNT) S.orders.push(newOrder());
}

/** Deliver order i. Returns the delivered order, or null if it cannot be filled. */
export function deliver(i: number): Order | null {
  const o = S.orders[i];
  if (!o || !canFill(o)) return null;
  for (const [k, q] of orderItems(o)) S.inv[k] = inv(k) - q;
  earn(o.coins);
  S.stats.orders++;
  gainXP(o.xp);
  S.orders.splice(i, 1);
  fillOrders();
  emit('orderDone', { coins: o.coins });
  return o;
}

export const canSkip = () => now() >= S.skipUntil;

export function skip(i: number): boolean {
  if (!canSkip() || !S.orders[i]) return false;
  S.orders.splice(i, 1, newOrder());
  S.skipUntil = now() + SKIP_COOLDOWN_MS;
  return true;
}
