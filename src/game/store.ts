import { MACHINE_IDS } from '../data/machines';
import { PACKS } from '../data/store';
import { now } from './clock';
import { gainGems } from './estate';
import { emit } from './events';
import { S } from './state';

/**
 * The diamond shop. Diamonds you earn in the game or buy with real money can be swapped for coins, a Double XP
 * boost, or rushing the workshops. Real-money checkout isn't connected yet: until it is, packs can only be
 * "bought" in test mode, which grants them without charging anything.
 */

export const XP_BOOST_MIN = 30;
export const XP_BOOST_GEMS = 20;
export const RUSH_GEMS = 5;
/** Coin bags: diamonds in, coins out. Bigger bags give more coins per diamond; both grow with your level. */
export const BAGS = [
  { id: 'bag', name: 'Bag of coins', gems: 10, mult: 1 },
  { id: 'sack', name: 'Sack of coins', gems: 45, mult: 5 },
  { id: 'crate', name: 'Crate of coins', gems: 100, mult: 12 },
] as const;
export const bagCoins = (i: number, level = S.level) => Math.round((300 + 120 * level) * BAGS[i].mult);

export type SpendResult = { ok: true } | { ok: false; reason: 'gems' | 'idle'; need?: number };

function spend(n: number): SpendResult {
  if (S.gems < n) return { ok: false, reason: 'gems', need: n - S.gems };
  S.gems -= n;
  return { ok: true };
}

export function buyBag(i: number): SpendResult {
  const r = spend(BAGS[i].gems);
  if (r.ok) S.coins += bagCoins(i);
  return r;
}

export const xpBoosted = (t = now()) => S.xpBoost > t;
export function buyXpBoost(t = now()): SpendResult {
  const r = spend(XP_BOOST_GEMS);
  if (r.ok) S.xpBoost = Math.max(t, S.xpBoost) + XP_BOOST_MIN * 60_000;
  return r;
}

/** Finish every running workshop job now. */
export const running = () => MACHINE_IDS.filter(k => S.machines[k].owned && S.machines[k].job);
export function rushMachines(t = now()): SpendResult {
  const jobs = running();
  if (!jobs.length) return { ok: false, reason: 'idle' };
  const r = spend(RUSH_GEMS);
  if (r.ok) for (const k of jobs) S.machines[k].job!.end = t;
  return r;
}

/** Test mode: on with ?testshop in the address, off with ?testshop=0. Remembered on this device. */
export function testShop(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('testshop');
    if (q !== null) localStorage.setItem('harvest-lane-testshop', q === '0' ? '0' : '1');
    return localStorage.getItem('harvest-lane-testshop') === '1';
  } catch { return false; }
}

export const canBuyPack = (id: string) => { const p = PACKS.find(x => x.id === id); return !!p && !(p.once && S.bought.includes(id)); };

/** Give the player a pack (after a payment, or a test purchase). `paid` delivers even a repeat one-time pack, since the money is in. */
export function grantPack(id: string, t = now(), paid = false) {
  const p = PACKS.find(x => x.id === id);
  if (!p || (!paid && !canBuyPack(id))) return false;
  if (p.once && !S.bought.includes(id)) S.bought.push(id);
  gainGems(p.gems, 'pack');
  if (p.coins) S.coins += p.coins;
  if (p.xpMin) S.xpBoost = Math.max(t, S.xpBoost) + p.xpMin * 60_000;
  emit('packBought', { id });
  return true;
}
