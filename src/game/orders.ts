import { CUSTOMERS } from '../data/customers';
import { ITEMS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS } from '../data/machines';
import { ORDER_COUNT, SKIP_COOLDOWN_MS } from '../data/limits';
import { now } from './clock';
import { earn, gainXP, inv, unlockedCrops } from './economy';
import { S, type Order } from './state';

function orderPool() {
  const pool: { k: ItemId; crop: boolean }[] = unlockedCrops().map(k => ({ k, crop: true }));
  for (const m of MACHINE_IDS) if (S.machines[m].owned) pool.push({ k: MACHINES[m].out, crop: false });
  return pool;
}

export function newOrder(rand = Math.random): Order {
  const pool = orderPool().sort(() => rand() - 0.5);
  const kinds = Math.min(pool.length, 1 + (rand() < (S.level >= 3 ? 0.6 : 0.3) ? 1 : 0) + (S.level >= 5 && rand() < 0.3 ? 1 : 0));
  const items: Order['items'] = {};
  let value = 0;
  for (let j = 0; j < kinds; j++) {
    const it = pool[j];
    const q = it.crop ? 3 + Math.floor(rand() * (4 + S.level)) : 1 + Math.floor(rand() * 3);
    items[it.k] = q;
    value += ITEMS[it.k].sell * q;
  }
  return {
    id: ++S.orderSeq,
    who: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
    items,
    coins: Math.round(value * 1.6 + 5),
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
  return o;
}

export const canSkip = () => now() >= S.skipUntil;

export function skip(i: number): boolean {
  if (!canSkip() || !S.orders[i]) return false;
  S.orders.splice(i, 1, newOrder());
  S.skipUntil = now() + SKIP_COOLDOWN_MS;
  return true;
}
