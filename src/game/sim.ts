import { CROP_IDS } from '../data/crops';
import { GOOD_IDS, MATERIALS, PRODUCT_IDS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS, recipe } from '../data/machines';
import { SELLER_INTERVAL_S } from '../data/limits';
import { now } from './clock';
import { add, byStaff, inv, mTime, sell, unitPrice } from './economy';
import { truckReserve } from './town';
import { animalTick } from './animals';
import { bindGoals, goalsTick } from './goals';
import { troubleTick } from './troubles';

bindGoals();
import { emit } from './events';
import { S } from './state';
import { truckTick } from './trucks';
import { contractTick } from './contracts';
import { fishTick } from './fishing';
import { payWages, staffTick, unpaid } from './staff';

let sellAcc = 0;

export function resetSim() { sellAcc = 0; }

/** The best thing a market seller can sell right now, or undefined. */
export function nextSale(): ItemId | undefined {
  // The best price on the market right now, keeping back anything a truck is coming for.
  const keep = truckReserve();
  const goods = [...GOOD_IDS, ...PRODUCT_IDS].filter(k => !MATERIALS.includes(k) && inv(k) > (keep[k] || 0)).sort((a, b) => unitPrice(b) - unitPrice(a));
  if (goods[0]) return goods[0];
  if (S.sellCrops) return CROP_IDS.filter(c => inv(c) > 10 + (keep[c] || 0)).sort((a, b) => unitPrice(b) - unitPrice(a))[0];
  return undefined;
}

/** Why the market sellers are standing still, or null while they have something to sell. */
export function sellersIdle(): 'unpaid' | 'empty' | null {
  if (!S.sellers) return null;
  if (unpaid) return 'unpaid';
  return nextSale() ? null : 'empty';
}

/** Advance workshops and market sellers by dt seconds. */
export function sim(dt: number) {
  const t = now();
  truckTick(t);
  contractTick(t);
  goalsTick(t);
  troubleTick(t);
  fishTick(t);
  staffTick(t);
  animalTick(t);
  payWages(dt);
  for (const k of MACHINE_IDS) {
    const m = S.machines[k], d = MACHINES[k];
    if (!m.owned) continue;
    if (m.job && t >= m.job.end) {
      // Machines work by themselves, so they earn no XP: it comes when you deliver what they make.
      add(d.out, 1);
      m.job = null;
      emit('machineDone', { id: k, out: d.out });
    }
    if (!m.job && m.on && recipe(k).every(([i, q]) => inv(i) >= q)) {
      for (const [i, q] of recipe(k)) S.inv[i] = inv(i) - q;
      m.job = { start: t, end: t + mTime(k) * 1000 };
    }
  }
  if (!unpaid) sellAcc += (dt * S.sellers) / SELLER_INTERVAL_S;
  while (sellAcc >= 1) {
    sellAcc -= 1;
    const k = nextSale();
    if (k) emit('sellerSale', { item: k, coins: byStaff(() => sell(k, 1)) });
  }
}
