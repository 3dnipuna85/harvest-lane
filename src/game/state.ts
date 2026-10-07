import { TIERS } from '../data/tiers';
import { CROPS, type CropId } from '../data/crops';
import { PRODUCT_IDS, type ItemId, type ProductId } from '../data/goods';
import { MACHINE_IDS, type MachineId } from '../data/machines';
import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { START_PLOTS } from '../data/limits';
import { LAND } from '../data/land';
import { now } from './clock';

export const SAVE_KEY = 'harvest-lane-3d-v1';
/** Bump this and add a step to MIGRATIONS whenever the save shape changes. */
export const SAVE_VERSION = 2;

export interface Plot { crop: CropId | null; at: number }
export interface Job { start: number; end: number }
export interface MachineState { owned: boolean; lvl: number; job: Job | null; on: boolean }
/** One kind of animal: how many, and each one's meal (when its product is ready; null while hungry). */
/**
 * ready: when each animal's product is done (null = hungry). hungry: since when it has waited for food.
 * sick: animals left hungry too long fall sick and need the vet.
 */
export interface Herd { n: number; ready: (number | null)[]; hungry: (number | null)[]; sick: boolean[] }
export interface Order {
  id: number;
  who: string;
  items: Partial<Record<ItemId, number>>;
  coins: number;
  xp: number;
}
/** A buyer waiting at the gate in a truck. Pays more than a board order, but only until `end`. */
/** A wholesale contract for machine goods: a big payment plus diamonds, with a long deadline. */
export interface Contract {
  items: Partial<Record<ItemId, number>>;
  who: string;
  coins: number;
  gems: number;
  xp: number;
  arrive: number;
  end: number;
}

export interface Truck extends Order { arrive: number; end: number }
export type Tab = 'orders' | 'barn' | 'animals' | 'machines' | 'helpers' | 'farm' | 'shop';

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
  stats: { earned: number; harvested: number; orders: number; trucks: number; missed: number; fish: number; shop: number; rotted: number };
  /** Lifetime count of each animal product collected. Buyers only ask for products the player has made before. */
  made: Partial<Record<ItemId, number>>;
  /** Recent sales of each item (decaying), so flooding the market lowers its price. See economy.ts. */
  market: Partial<Record<ItemId, { n: number; t: number }>>;
  /** When each paid staff contract ends (ms timestamp; 0 = not hired). */
  staff: { manager: number; keeper: number; fisher: number; shopkeeper: number; lumberjack: number; miner: number };
  /** Market Town: whether the player owns a shop there, and how many times the pen was enlarged. */
  town: { shop: boolean; pen: number };
  /** Fertilizer runs until this time (ms); crops planted before then grow faster. */
  boost: number;
  /** Double XP runs until this time (ms), bought with diamonds in the shop. */
  xpBoost: number;
  /** Real-money packs already bought, by id (one-time packs can't be bought twice). */
  bought: string[];
  /** The contract lorry waiting for machine goods (game/contracts.ts), and when the next one comes (0 = not scheduled). */
  contract: Contract | null;
  nextContract: number;
  /** When each tree in the Woods / rock in the Quarry is back (ms; 0 = standing now). */
  woods: number[];
  rocks: number[];
  /** Tips windows already shown (ui/tips.ts). */
  tips: string[];
  /** Diamonds, the rare currency for farm upgrades. */
  gems: number;
  /** Farm tier (data/tiers.ts): caps the level until upgraded. */
  tier: number;
  /** When the shop last turned up a diamond (ms). */
  gemAt: number;
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

function freshHerds(t = now()) {
  const h = {} as Record<AnimalId, Herd>;
  for (const k of ANIMAL_IDS) { const n = ANIMALS[k].start; h[k] = { n, ready: Array(n).fill(null), hungry: Array(n).fill(t), sick: Array(n).fill(false) }; }
  return h;
}

export function fresh(t = now()): State {
  const machines = {} as Record<MachineId, MachineState>;
  for (const k of MACHINE_IDS) machines[k] = { owned: false, lvl: 1, job: null, on: true };
  const s: State = {
    version: SAVE_VERSION,
    coins: 30, xp: 0, level: 1, sel: 'wheat', tab: 'orders',
    plots: Array.from({ length: START_PLOTS }, () => ({ crop: null, at: 0 })),
    inv: { wheat: 2 }, machines, farmhands: 0, sellers: 0, sellCrops: true,
    orders: [], skipUntil: 0, orderSeq: 0,
    animals: freshHerds(t),
    truck: null, nextTruck: t + 25000, nextWants: null, rep: 3,
    stats: { earned: 0, harvested: 0, orders: 0, trucks: 0, missed: 0, fish: 0, shop: 0, rotted: 0 }, made: {}, market: {}, land: 0, staff: { manager: 0, keeper: 0, fisher: 0, shopkeeper: 0, lumberjack: 0, miner: 0 }, town: { shop: false, pen: 0 }, boost: 0, xpBoost: 0, bought: [], saved: t, gems: 0, tier: 0, gemAt: 0, contract: null, nextContract: 0, woods: [], rocks: [], tips: [],
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
  // Sellers used to stand idle when the barn held only crops; now they sell spare crops unless told not to.
  1: s => ({ ...s, sellCrops: true, version: 2 }),
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
  out.staff = { manager: +s.staff?.manager || 0, keeper: +s.staff?.keeper || 0, fisher: +s.staff?.fisher || 0, shopkeeper: +s.staff?.shopkeeper || 0, lumberjack: +s.staff?.lumberjack || 0, miner: +s.staff?.miner || 0 };
  out.town = { shop: !!s.town?.shop, pen: Math.max(0, Math.min(3, Math.floor(+s.town?.pen || 0))) };
  out.boost = +s.boost || 0;
  out.xpBoost = +s.xpBoost || 0;
  out.bought = Array.isArray(s.bought) ? s.bought.filter((v: unknown) => typeof v === 'string') : [];
  out.gemAt = +s.gemAt || 0;
  out.nextContract = +s.nextContract || 0;
  out.woods = Array.isArray(s.woods) ? s.woods.map((v: unknown) => +(v as number) || 0) : [];
  out.rocks = Array.isArray(s.rocks) ? s.rocks.map((v: unknown) => +(v as number) || 0) : [];
  // Farms from before the tips already know the bakery and the shop.
  out.tips = Array.isArray(s.tips) ? s.tips.filter((v: unknown) => typeof v === 'string') : out.level >= 8 ? ['bakery', 'shop'] : out.level >= 2 ? ['bakery'] : [];
  out.contract = s.contract && typeof s.contract === 'object' && s.contract.items && +s.contract.end ? s.contract as Contract : null;
  out.gems = Math.max(0, Math.floor(+s.gems || 0));
  // Farms from before tiers keep their level: they start on the first tier that allows it.
  out.tier = typeof s.tier === 'number' ? Math.max(0, Math.min(TIERS.length - 1, Math.floor(s.tier))) : Math.max(0, TIERS.findIndex(x => x.cap > (+s.level || 1)));
  out.land = Math.max(0, Math.min(LAND.length, Math.floor(+s.land || 0)));
  out.made = { ...(s.made && typeof s.made === 'object' ? s.made : {}) };
  out.market = { ...(s.market && typeof s.market === 'object' ? s.market : {}) };
  out.animals = freshHerds();
  for (const k of ANIMAL_IDS) {
    const h = s.animals?.[k];
    if (!h || typeof h.n !== 'number') continue;
    const n = Math.max(0, Math.min(ANIMALS[k].max + 2 * out.town.pen, Math.floor(h.n)));
    const ready = Array.from({ length: n }, (_, i) => (typeof h.ready?.[i] === 'number' ? h.ready[i] as number : null));
    // older saves have no hunger clock: a hungry animal starts waiting from now
    const hungry = ready.map((r, i) => (r != null ? null : typeof h.hungry?.[i] === 'number' ? h.hungry[i] as number : now()));
    out.animals[k] = { n, ready, hungry, sick: Array.from({ length: n }, (_, i) => !!h.sick?.[i]) };
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
