import { MACHINES, MACHINE_IDS } from '../data/machines';
import { now } from './clock';
import { earn, gainXP, inv } from './economy';
import { gainGems } from './estate';
import { emit } from './events';
import { basketValue, canFill, orderItems } from './orders';
import { S, type Contract } from './state';
import { repPay } from './trucks';

/**
 * Contract lorries: big, rare wholesale buyers who want only goods from your machines. They give you time to
 * produce (10 minutes), pay over three times the goods' value and bring diamonds, but only you can load one.
 * A missed contract costs a reputation star.
 */
export const CONTRACT_GAP_MS: [number, number] = [14 * 60_000, 24 * 60_000];
export const CONTRACT_WAIT_MS = 10 * 60_000;
export const CONTRACT_PAY = 3.2;

const gap = (rand: () => number) => CONTRACT_GAP_MS[0] + rand() * (CONTRACT_GAP_MS[1] - CONTRACT_GAP_MS[0]);
const owned = () => MACHINE_IDS.filter(m => S.machines[m].owned);

export function newContract(t = now(), rand = Math.random): Contract | null {
  const ms = owned().sort(() => rand() - 0.5).slice(0, rand() < 0.5 ? 1 : 2);
  if (!ms.length) return null;
  const items: Contract['items'] = {};
  for (const m of ms) items[MACHINES[m].out] = 4 + Math.floor(rand() * 3) + Math.floor(S.level / 4);
  const count = Object.values(items).reduce((a, q) => a + (q || 0), 0);
  return {
    items,
    who: 'Valley Wholesale',
    coins: Math.round(basketValue(items, 1, CONTRACT_PAY) * repPay()),
    gems: 1 + Math.min(4, Math.floor(count / 6)),
    xp: Math.round(basketValue(items, 1, 1) / 5),
    arrive: t,
    end: t + CONTRACT_WAIT_MS,
  };
}

export const canFillContract = () => !!S.contract && canFill({ id: 0, who: '', coins: 0, xp: 0, items: S.contract.items });

/** Load the contract lorry. Returns what it paid, or null if the barn is short. */
export function deliverContract(t = now(), rand = Math.random) {
  const c = S.contract;
  if (!c || !canFillContract()) return null;
  for (const [k, q] of orderItems({ id: 0, who: '', coins: 0, xp: 0, items: c.items })) S.inv[k] = inv(k) - q;
  earn(c.coins);
  gainXP(c.xp);
  gainGems(c.gems, 'contract');
  S.rep = Math.min(5, S.rep + 0.5);
  S.stats.orders++;
  S.contract = null;
  S.nextContract = t + gap(rand);
  emit('contractDone', { coins: c.coins, gems: c.gems });
  return c;
}

/** Bring contracts in once the farm has a machine, and send them away when time runs out. Called from sim(). */
export function contractTick(t = now(), rand = Math.random) {
  const c = S.contract;
  if (c && t >= c.end) {
    S.contract = null;
    S.nextContract = t + gap(rand);
    // Like trucks, it only costs a star if you were here to watch it leave.
    if (t - c.end < 5000) { S.rep = Math.max(1, S.rep - 1); emit('contractMissed', { coins: c.coins }); }
  } else if (!c && owned().length) {
    if (!S.nextContract) S.nextContract = t + 3 * 60_000;
    else if (t >= S.nextContract) {
      S.contract = newContract(t, rand);
      if (S.contract) emit('contractArrive', { who: S.contract.who });
    }
  }
}
