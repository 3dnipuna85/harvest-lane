import { CUSTOMERS } from '../data/customers';
import { TRUCK_BASE_S, TRUCK_GAP_S, TRUCK_PER_ITEM_S, TRUCK_TIP } from '../data/limits';
import { now } from './clock';
import { earn, gainXP, hands, inv } from './economy';
import { emit } from './events';
import { basketValue, canFill, newOrder, orderItems } from './orders';
import { S, type Order, type Truck } from './state';

/** A missed truck only costs reputation if the player was here to see it leave (not while the game was closed). */
const MISS_GRACE_MS = 5000;

/** Trucks pay 1.3x for raw crops but 2.6x for bread, juice, eggs and the like. */
const TRUCK_CROP_PAY = 1.3, TRUCK_MADE_PAY = 2.6;

const gap = (rand: () => number) => (TRUCK_GAP_S[0] + rand() * (TRUCK_GAP_S[1] - TRUCK_GAP_S[0])) * 1000;

/** Pay multiplier from reputation: 1 star 0.8x, 3 stars 1x, 5 stars 1.2x. */
export const repPay = () => 0.7 + S.rep * 0.1;

/** A bulk order for a truck: half again as much of each item as a board order. */
export function truckWants(rand = Math.random): Order['items'] {
  const o = newOrder(rand);
  for (const [k, q] of orderItems(o)) o.items[k] = Math.ceil(q * 1.5);
  return o.items;
}

export function newTruck(t = now(), rand = Math.random, wants = truckWants(rand)): Truck {
  const o = newOrder(rand);
  o.items = { ...wants };
  const items = orderItems(o);
  const value = basketValue(o.items, 1, 1);
  const count = items.reduce((n, [, q]) => n + q, 0);
  return {
    ...o,
    who: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
    coins: Math.round((basketValue(o.items, TRUCK_CROP_PAY, TRUCK_MADE_PAY) + 10) * repPay()),
    xp: Math.max(3, Math.round(value / 4)),
    arrive: t,
    end: t + (TRUCK_BASE_S + count * TRUCK_PER_ITEM_S) * 1000,
  };
}

/** Coins the waiting truck would pay right now, including the tip while it is still early. */
export function truckOffer(t = now()) {
  const k = S.truck;
  if (!k) return { coins: 0, tip: 0 };
  const early = t - k.arrive < (k.end - k.arrive) / 2;
  return { coins: k.coins, tip: early ? Math.round(k.coins * TRUCK_TIP) : 0 };
}

export const canFillTruck = () => !!S.truck && canFill(S.truck);

/** Load the waiting truck. Returns what it paid, or null if the barn is short. */
export function deliverTruck(t = now(), rand = Math.random) {
  const k = S.truck;
  if (!k || !canFill(k)) return null;
  // The tip is for loading it yourself, quickly; a truck your manager loads pays the base price.
  const { coins } = truckOffer(t), tip = hands.staff ? 0 : truckOffer(t).tip;
  for (const [i, q] of orderItems(k)) S.inv[i] = inv(i) - q;
  earn(coins + tip);
  gainXP(k.xp);
  S.stats.orders++;
  S.stats.trucks++;
  S.rep = Math.min(5, S.rep + (tip ? 0.5 : 0.25));
  S.truck = null;
  S.nextTruck = t + gap(rand);
  emit('truckDone', { who: k.who, coins, tip, items: orderItems(k).flatMap(([i, q]) => Array(Math.min(q, 4)).fill(i)) });
  return { who: k.who, coins, tip };
}

/** Send trucks in and out on schedule. Called from sim(). */
export function truckTick(t = now(), rand = Math.random) {
  const k = S.truck;
  if (!k && !S.nextWants) S.nextWants = truckWants(rand);
  if (k && t >= k.end) {
    S.truck = null;
    S.nextTruck = t + gap(rand);
    if (t - k.end < MISS_GRACE_MS) {
      S.rep = Math.max(1, S.rep - 1);
      S.stats.missed++;
      emit('truckMissed', { who: k.who, coins: k.coins });
    }
  } else if (!k && t >= S.nextTruck) {
    S.truck = newTruck(t, rand, S.nextWants ?? undefined);
    S.nextWants = null;
    emit('truckArrive', { who: S.truck.who });
  }
}
