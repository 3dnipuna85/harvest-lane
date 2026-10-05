import { CROPS, type CropId } from '../data/crops';
import { PRODUCT_IDS, type ItemId, type ProductId } from '../data/goods';
import { MACHINE_IDS, type MachineId } from '../data/machines';
import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { START_PLOTS } from '../data/limits';
import { LAND } from '../data/land';
import { now } from './clock';

export const SAVE_KEY = 'harvest-lane-3d-v1';
/** Bump this and add a step to MIGRATIONS whenever the save shape changes. */
export const SAVE_VERSION = 1;

export interface Plot { crop: CropId | null; at: number }
export interface Job { start: number; end: number }
export interface MachineState { owned: boolean; lvl: number; job: Job | null; on: boolean }
/** One kind of animal: how many, and each one's meal (when its product is ready; null while hungry). */
export interface Herd { n: number; ready: (number | null)[] }
export interface Order {
  id: number;
  who: string;
  items: Partial<Record<ItemId, number>>;
  coins: number;
  xp: number;
}
/** A buyer waiting at the gate in a truck. Pays more than a board order, but only until `end`. */
export interface Truck extends Order { arrive: number; end: number }
export type Tab = 'orders' | 'barn' | 'animals' | 'machines' | 'helpers';

export interface State {
  version: number;
  coins: number;
  xp: number;
  level: number;
  sel: CropId;
  tab: Tab;
  plots: Plot[];
  inv: Partial<Record<ItemId, number>>;
  machines: Record<MachineId, MachineState>;
  farmhands: number;
  sellers: number;
  sellCrops: boolean;
  orders: Order[];
  skipUntil: number;
  orderSeq: number;
  animals: Record<AnimalId, Herd>;
  truck: Truck | null;
  /** When the next truck pulls up (ms timestamp). */
  nextTruck: number;
  /** What the next truck will ask for, shown ahead of time so the player can prepare. */
  nextWants: Order['items'] | null;
  /** Buyer reputation, 1 to 5 stars. On-time trucks raise it and pay more; missed trucks lower it. */
  rep: number;
  /** Lifetime totals shown on the player's profile. */
  stats: { earned: number; harvested: number; orders: number; trucks: number; missed: number; fish: number };
  /** Lifetime count of each animal product collected. Buyers only ask for products the player has made before. */
  made: Partial<Record<ItemId, number>>;
  /** How many land parcels (data/land.ts, in order) the farm owns. */
  land: number;
  saved: number;
}

/** The live game state. Reassigned only through setState(). */
export let S: State;
export function setState(s: State) { S = s; }

/** True while looking around a friend's farm: S is their copy, so nothing may change it, save it or simulate it. */
export let visiting = false;
export function setVisiting(on: boolean) { visiting = on; }

function freshHerds() {
  const h = {} as Record<AnimalId, Herd>;
  for (const k of ANIMAL_IDS) h[k] = { n: ANIMALS[k].start, ready: Array(ANIMALS[k].start).fill(null) };
  return h;
}

export function fresh(t = now()): State {
  const machines = {} as Record<MachineId, MachineState>;
  for (const k of MACHINE_IDS) machines[k] = { owned: false, lvl: 1, job: null, on: true };
  const s: State = {
    version: SAVE_VERSION,
    coins: 30, xp: 0, level: 1, sel: 'wheat', tab: 'orders',
    plots: Array.from({ length: START_PLOTS }, () => ({ crop: null, at: 0 })),
    inv: { wheat: 2 }, machines, farmhands: 0, sellers: 0, sellCrops: false,
    orders: [], skipUntil: 0, orderSeq: 0,
    animals: freshHerds(),
    truck: null, nextTruck: t + 25000, nextWants: null, rep: 3,
    stats: { earned: 0, harvested: 0, orders: 0, trucks: 0, missed: 0, fish: 0 }, made: {}, land: 0, saved: t,
  };
  // A head start: three wheat plots, two of them close to ripe.
  s.plots[0] = { crop: 'wheat', at: t - 4500 };
  s.plots[1] = { crop: 'wheat', at: t - 6500 };
  s.plots[2] = { crop: 'wheat', at: t - 2000 };
  return s;
}

type Raw = Record<string, any>;
/** MIGRATIONS[n] upgrades a save from version n to n + 1. */
const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // Version 0 is the prototype's unversioned save; its shape already matches version 1.
  0: s => ({ ...s, version: 1 }),
};

/** Turn whatever was stored (possibly old, partial or junk) into a valid current State. */
export function migrate(raw: unknown): State {
  const base = fresh();
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Raw).plots)) return base;
  let s = raw as Raw;
  let v = typeof s.version === 'number' ? s.version : 0;
  while (v < SAVE_VERSION && MIGRATIONS[v]) { s = MIGRATIONS[v](s); v++; }
  const out: State = { ...base, ...s, version: SAVE_VERSION, inv: { ...(s.inv || {}) }, machines: { ...base.machines } } as State;
  out.stats = { ...base.stats, ...(s.stats || {}) };
  out.land = Math.max(0, Math.min(LAND.length, Math.floor(+s.land || 0)));
  out.made = { ...(s.made && typeof s.made === 'object' ? s.made : {}) };
  out.animals = freshHerds();
  for (const k of ANIMAL_IDS) {
    const h = s.animals?.[k];
    if (!h || typeof h.n !== 'number') continue;
    const n = Math.max(0, Math.min(ANIMALS[k].max, Math.floor(h.n)));
    out.animals[k] = { n, ready: Array.from({ length: n }, (_, i) => (typeof h.ready?.[i] === 'number' ? h.ready[i] : null)) };
  }
  for (const k of MACHINE_IDS) if (s.machines && s.machines[k]) out.machines[k] = { ...base.machines[k], ...s.machines[k] };
  out.plots = (s.plots as Raw[]).map(p => (p && p.crop in CROPS ? { crop: p.crop, at: +p.at || 0 } : { crop: null, at: 0 }));
  if (!(out.sel in CROPS)) out.sel = 'wheat';
  if (!Array.isArray(out.orders)) out.orders = [];
  // Older saves could queue a truck for an animal product the player never made; ask again.
  const unmade = (it: unknown) => !!it && Object.keys(it as object).some(k => PRODUCT_IDS.includes(k as ProductId) && !out.made[k as ItemId]);
  if (unmade(out.nextWants)) out.nextWants = null;
  out.orders = out.orders.filter(o => !unmade(o?.items));
  return out;
}

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function save() {
  if (!S || visiting) return;
  S.saved = now();
  try { storage()?.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
}

export function load(): unknown {
  try { const raw = storage()?.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
