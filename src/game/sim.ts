import { CROPS, CROP_IDS } from '../data/crops';
import { GOOD_IDS, ITEMS, PRODUCT_IDS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS, recipe } from '../data/machines';
import { SELLER_INTERVAL_S } from '../data/limits';
import { now } from './clock';
import { add, gainXP, goodXP, inv, mTime, sell } from './economy';
import { emit } from './events';
import { S } from './state';
import { truckTick } from './trucks';

let sellAcc = 0;

export function resetSim() { sellAcc = 0; }

/** The best thing a market seller can sell right now, or undefined. */
export function nextSale(): ItemId | undefined {
  const goods = [...GOOD_IDS, ...PRODUCT_IDS].filter(k => inv(k) > 0).sort((a, b) => ITEMS[b].sell - ITEMS[a].sell);
  if (goods[0]) return goods[0];
  if (S.sellCrops) return CROP_IDS.filter(c => inv(c) > 10).sort((a, b) => CROPS[b].sell - CROPS[a].sell)[0];
  return undefined;
}

/** Advance workshops and market sellers by dt seconds. */
export function sim(dt: number) {
  const t = now();
  truckTick(t);
  for (const k of MACHINE_IDS) {
    const m = S.machines[k], d = MACHINES[k];
    if (!m.owned) continue;
    if (m.job && t >= m.job.end) {
      add(d.out, 1);
      gainXP(goodXP(d.out));
      m.job = null;
      emit('machineDone', { id: k, out: d.out });
    }
    if (!m.job && m.on && recipe(k).every(([i, q]) => inv(i) >= q)) {
      for (const [i, q] of recipe(k)) S.inv[i] = inv(i) - q;
      m.job = { start: t, end: t + mTime(k) * 1000 };
    }
  }
  sellAcc += (dt * S.sellers) / SELLER_INTERVAL_S;
  while (sellAcc >= 1) {
    sellAcc -= 1;
    const k = nextSale();
    if (k) emit('sellerSale', { item: k, coins: sell(k, 1) });
  }
}
