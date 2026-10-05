import { CROPS, type CropId } from '../data/crops';
import type { ItemId } from '../data/goods';
import { MACHINE_IDS, type MachineId } from '../data/machines';
import { START_PLOTS } from '../data/limits';
import { now } from './clock';

export const SAVE_KEY = 'harvest-lane-3d-v1';
/** Bump this and add a step to MIGRATIONS whenever the save shape changes. */
export const SAVE_VERSION = 1;

export interface Plot { crop: CropId | null; at: number }
export interface Job { start: number; end: number }
export interface MachineState { owned: boolean; lvl: number; job: Job | null; on: boolean }
export interface Order {
  id: number;
  who: string;
  items: Partial<Record<ItemId, number>>;
  coins: number;
  xp: number;
}
/** A buyer waiting at the gate in a truck. Pays more than a board order, but only until `end`. */
export interface Truck extends Order { arrive: number; end: number }
export type Tab = 'orders' | 'barn' | 'machines' | 'helpers';

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
  truck: Truck | null;
  /** When the next truck pulls up (ms timestamp). */
  nextTruck: number;
  /** Buyer reputation, 1 to 5 stars. On-time trucks raise it and pay more; missed trucks lower it. */
  rep: number;
  /** Lifetime totals shown on the player's profile. */
  stats: { earned: number; harvested: number; orders: number; trucks: number; missed: number };
  saved: number;
}

/** The live game state. Reassigned only through setState(). */
export let S: State;
export function setState(s: State) { S = s; }

export function fresh(t = now()): State {
  const machines = {} as Record<MachineId, MachineState>;
  for (const k of MACHINE_IDS) machines[k] = { owned: false, lvl: 1, job: null, on: true };
  const s: State = {
    version: SAVE_VERSION,
    coins: 30, xp: 0, level: 1, sel: 'wheat', tab: 'orders',
    plots: Array.from({ length: START_PLOTS }, () => ({ crop: null, at: 0 })),
    inv: { wheat: 2 }, machines, farmhands: 0, sellers: 0, sellCrops: false,
    orders: [], skipUntil: 0, orderSeq: 0,
    truck: null, nextTruck: t + 25000, rep: 3,
    stats: { earned: 0, harvested: 0, orders: 0, trucks: 0, missed: 0 }, saved: t,
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
  for (const k of MACHINE_IDS) if (s.machines && s.machines[k]) out.machines[k] = { ...base.machines[k], ...s.machines[k] };
  out.plots = (s.plots as Raw[]).map(p => (p && p.crop in CROPS ? { crop: p.crop, at: +p.at || 0 } : { crop: null, at: 0 }));
  if (!(out.sel in CROPS)) out.sel = 'wheat';
  if (!Array.isArray(out.orders)) out.orders = [];
  return out;
}

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function save() {
  if (!S) return;
  S.saved = now();
  try { storage()?.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
}

export function load(): unknown {
  try { const raw = storage()?.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
