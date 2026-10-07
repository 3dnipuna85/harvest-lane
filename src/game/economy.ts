import { live } from './live';
import { CROPS, CROP_IDS, DOUBLE_HARVEST_CHANCE, type CropId } from '../data/crops';
import { ITEMS, type ItemId } from '../data/goods';
import { MACHINES, MACHINE_IDS, type MachineId } from '../data/machines';
import { MAX_FARMHANDS, MAX_MACHINE_LEVEL, MAX_PLOTS, MAX_SELLERS, START_PLOTS } from '../data/limits';
import { TIERS } from '../data/tiers';
import { LAND, PARCEL_PLOTS, RIVER0, RIVER_PLOTS } from '../data/land';
import { BARN_PAY, HOUSE_XP } from '../data/buildings';
import { now } from './clock';
import { emit } from './events';
import { S, type Plot } from './state';

/** XP for the next level. The first five levels come quickly; after that each one takes much longer. */
/** XP for the next level. The first few levels come quickly; from level 4 on each one asks a good deal more. */
export const xpNeed = (l: number) => Math.round(14 * Math.pow(l, 1.55) * (1 + Math.pow(Math.max(0, l - 5), 1.3) / 6) * (1 + Math.max(0, l - 3) / 6));

/**
 * Whose hands are doing the work. XP comes only from the player's own work: crops your staff pick, trucks your
 * manager loads and fish your fisherman lands earn coins, never XP.
 */
export const hands = { staff: false };
export function byStaff<T>(fn: () => T): T {
  const was = hands.staff;
  hands.staff = true;
  try { return fn(); } finally { hands.staff = was; }
}

/**
 * Market demand: selling lots of one item floods the market and its price drops, then recovers over time
 * (half the glut clears every 15 minutes). Truck and order payments are contracts and don't change.
 */
const GLUT_HALF_MS = 15 * 60_000;
const GLUT_SIZE = 30;
const glut = (k: ItemId, t = now()) => { const m = S.market[k]; return m ? m.n * Math.pow(0.5, (t - m.t) / GLUT_HALF_MS) : 0; };
export const priceFactor = (k: ItemId, t = now()) => Math.max(0.35, 1 / (1 + glut(k, t) / GLUT_SIZE));
/** A bigger barn (data/buildings.ts) keeps goods fresher, so everything sold pays a little more. */
export const barnPay = () => 1 + BARN_PAY * (S.build?.barn || 0);
export const unitPrice = (k: ItemId, t = now()) => Math.max(1, Math.round(ITEMS[k].sell * priceFactor(k, t) * barnPay()));
/** Record a sale in the market's memory. */
export function flood(k: ItemId, n = 1, t = now()) { S.market[k] = { n: glut(k, t) + n, t }; }
/** Where the next plot would go: the home field, a riverside row (once all land is bought), or nowhere (buy land). */
export function plotSlot(n = S.plots.length): 'home' | 'river' | null {
  if (n < MAX_PLOTS) return 'home';
  if (S.land >= LAND.length && n >= RIVER0 && n < RIVER0 + RIVER_PLOTS.length) return 'river';
  return null;
}
/** Level needed for the next plot: home plots unlock two per level from level 2; riverside plots have their own. */
export function plotLvl(n = S.plots.length) {
  if (plotSlot(n) === 'river') return RIVER_PLOTS[n - RIVER0].lvl;
  return n < START_PLOTS ? 1 : Math.ceil((n - START_PLOTS + 1) / 2) + 1;
}
/** Riverside plots also need building materials. */
export const plotMats = (n = S.plots.length): Mats => (plotSlot(n) === 'river' ? RIVER_PLOTS[n - RIVER0].mats : {});
export const plotCost = (n = S.plots.length) => plotSlot(n) === 'river' ? RIVER_PLOTS[n - RIVER0].cost : Math.round(40 * Math.pow(1.5, n - START_PLOTS));
export const farmhandCost = () => Math.round(80 * Math.pow(1.8, S.farmhands));
export const sellerCost = () => Math.round(150 * Math.pow(1.9, S.sellers));
/** Production time in seconds; each upgrade level is 18% faster. */
export const mTime = (k: MachineId) => MACHINES[k].time * Math.pow(0.82, S.machines[k].lvl - 1);
export const mUpCost = (k: MachineId) => Math.round(MACHINES[k].cost * 0.6 * S.machines[k].lvl);
/** Building materials, as {item: qty}. */
export type Mats = Partial<Record<ItemId, number>>;
export const matsOk = (m: Mats) => (Object.entries(m) as [ItemId, number][]).every(([k, q]) => inv(k) >= q);
const payMats = (m: Mats) => { for (const [k, q] of Object.entries(m) as [ItemId, number][]) S.inv[k] = inv(k) - q; };
/** Once the Woods are open (level 9), making a workshop faster also takes planks, and from its third level bricks. */
export function mUpMats(k: MachineId): Mats {
  const l = S.machines[k].lvl;
  if (S.level < 9) return {};
  return l >= 2 ? { plank: 10 * l, brick: 6 * (l - 1) } : { plank: 10 };
}
export const inv = (k: ItemId) => S.inv[k] || 0;
export const add = (k: ItemId, n: number) => { S.inv[k] = inv(k) + n; };
export const totalItems = () => (Object.keys(ITEMS) as ItemId[]).reduce((a, k) => a + inv(k), 0);
export const growProgress = (p: Plot) => (p.crop ? Math.min(1, (now() - p.at) / (CROPS[p.crop].time * 1000)) : 0);
export const ripe = (p: Plot) => !!p.crop && now() >= p.at + CROPS[p.crop].time * 1000;
/** A ripe crop left on the plant rots after this long (8 minutes, plus a little more for slow crops). */
export const rotMs = (c: CropId) => (8 * 60 + CROPS[c].time * 10) * 1000;
/** Time until a ripe crop rots (negative once it has). */
export const rotIn = (p: Plot, t = now()) => (p.crop ? p.at + CROPS[p.crop].time * 1000 + rotMs(p.crop) - t : Infinity);
export const rotten = (p: Plot, t = now()) => !!p.crop && rotIn(p, t) <= 0;
export const unlockedCrops = () => CROP_IDS.filter(k => CROPS[k].lvl <= S.level);

export function gainXP(n: number) {
  if (hands.staff) return;
  // A Double XP boost from the diamond shop (game/store.ts) doubles what you earn while it lasts, and so does
  // an XP event the owner runs from the admin page (game/live.ts); together they make it triple.
  const t = now(), boost = S.xpBoost > t, ev = live.xpEventUntil > t;
  // A nicer farmhouse adds a little on top.
  n *= 1 + HOUSE_XP * (S.build?.house || 0);
  S.xp += Math.round(boost && ev ? n * 3 : boost || ev ? n * 2 : n);
  const cap = TIERS[S.tier]?.cap ?? Infinity;
  if (S.level >= cap) {
    // The farm tier caps the level: the bar fills and waits for a farm upgrade.
    if (S.xp >= xpNeed(S.level)) { S.xp = xpNeed(S.level); emit('levelCapped', { level: S.level }); }
    return;
  }
  while (S.xp >= xpNeed(S.level) && S.level < cap) {
    S.xp -= xpNeed(S.level);
    S.level++;
    const unlocked: string[] = [];
    for (const k of CROP_IDS) if (CROPS[k].lvl === S.level) unlocked.push(CROPS[k].icon + ' ' + CROPS[k].name + ' seeds');
    for (const k of MACHINE_IDS) if (MACHINES[k].lvl === S.level) unlocked.push(MACHINES[k].name);
    if (S.level === 2) unlocked.push('Farmhands');
    if (S.level === 3) unlocked.push('Market sellers');
    S.gems++;
    emit('levelUp', { level: S.level, unlocked });
  }
  if (S.level >= cap && S.xp >= xpNeed(S.level)) { S.xp = xpNeed(S.level); emit('levelCapped', { level: S.level }); }
}

export function earn(n: number) {
  S.coins += n;
  S.stats.earned += n;
  emit('earn', { amount: n });
}

/** Plant the selected seed on plot i. Returns false if the player cannot afford it. */
/** Plant `crop` (the seed selected when the plot was tapped; defaults to the current selection). */
export function plant(i: number, crop: CropId = S.sel): boolean {
  const p = S.plots[i], c = CROPS[crop];
  if (!p || S.coins < c.seed) return false;
  S.coins -= c.seed;
  p.crop = crop;
  // Fertilizer from the town store: planting while it lasts gives the crop a head start.
  p.at = now() - (S.boost > now() ? CROPS[crop].time * 1000 * 0.25 : 0);
  emit('plant', { i, crop });
  return true;
}

export function harvest(i: number, rand = Math.random): number {
  const p = S.plots[i];
  if (!p || !p.crop) return 0;
  const crop = p.crop;
  // A rotten crop is only good for the compost heap: clearing it frees the plot but yields nothing.
  if (rotten(p)) {
    p.crop = null; p.at = 0;
    S.stats.rotted = (S.stats.rotted || 0) + 1;
    emit('cropRotted', { i, crop });
    return 0;
  }
  const n = rand() < DOUBLE_HARVEST_CHANCE ? 2 : 1;
  add(crop, n);
  S.stats.harvested += n;
  gainXP(CROPS[crop].xp * n);
  p.crop = null;
  p.at = 0;
  emit('harvest', { i, crop, n });
  return n;
}

/** Sell up to n of an item. Returns the coins earned. */
export function sell(k: ItemId, n: number): number {
  n = Math.min(n, inv(k));
  if (n <= 0) return 0;
  S.inv[k] = inv(k) - n;
  let g = 0;
  for (let j = 0; j < n; j++) { g += unitPrice(k); flood(k); }
  earn(g);
  return g;
}

export type BuyResult = { ok: true } | { ok: false; reason: 'max' | 'coins' | 'locked' | 'mats'; cost?: number; lvl?: number };

export function buyPlot(): BuyResult {
  if (!plotSlot()) return { ok: false, reason: 'max' };
  if (S.level < plotLvl()) return { ok: false, reason: 'locked', lvl: plotLvl() };
  const c = plotCost(), m = plotMats();
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  if (!matsOk(m)) return { ok: false, reason: 'mats' };
  S.coins -= c;
  payMats(m);
  S.plots.push({ crop: null, at: 0 });
  return { ok: true };
}

/** The next land parcel for sale, if any. */
export const nextParcel = () => LAND[S.land];

export type LandResult = { ok: true; k: number } | { ok: false; reason: 'max' | 'coins' | 'locked' | 'field' | 'mats'; cost?: number; lvl?: number };

/** Buy the next parcel of land: it arrives with a full field of empty plots. The home field must be full first. */
export function buyLand(): LandResult {
  const p = nextParcel();
  if (!p) return { ok: false, reason: 'max' };
  if (S.plots.length < MAX_PLOTS + S.land * PARCEL_PLOTS) return { ok: false, reason: 'field' };
  if (S.level < p.lvl) return { ok: false, reason: 'locked', lvl: p.lvl };
  if (S.coins < p.cost) return { ok: false, reason: 'coins', cost: p.cost };
  if (!matsOk(p.mats)) return { ok: false, reason: 'mats' };
  S.coins -= p.cost;
  payMats(p.mats);
  const k = S.land++;
  for (let j = 0; j < PARCEL_PLOTS; j++) S.plots.push({ crop: null, at: 0 });
  emit('landBought', { k });
  return { ok: true, k };
}

export function buyMachine(k: MachineId): BuyResult {
  const d = MACHINES[k];
  if (d.lvl > S.level) return { ok: false, reason: 'locked' };
  if (S.machines[k].owned) return { ok: false, reason: 'max' };
  if (S.coins < d.cost) return { ok: false, reason: 'coins', cost: d.cost };
  S.coins -= d.cost;
  S.machines[k].owned = true;
  return { ok: true };
}

export function upgradeMachine(k: MachineId): BuyResult {
  const c = mUpCost(k), m = mUpMats(k);
  if (S.machines[k].lvl >= MAX_MACHINE_LEVEL) return { ok: false, reason: 'max' };
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  if (!matsOk(m)) return { ok: false, reason: 'mats' };
  S.coins -= c;
  payMats(m);
  S.machines[k].lvl++;
  return { ok: true };
}

export function hire(kind: 'farmhand' | 'seller'): BuyResult {
  if (kind === 'farmhand') {
    const c = farmhandCost();
    if (S.level < 2) return { ok: false, reason: 'locked' };
    if (S.farmhands >= MAX_FARMHANDS) return { ok: false, reason: 'max' };
    if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
    S.coins -= c; S.farmhands++;
  } else {
    const c = sellerCost();
    if (S.level < 3) return { ok: false, reason: 'locked' };
    if (S.sellers >= MAX_SELLERS) return { ok: false, reason: 'max' };
    if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
    S.coins -= c; S.sellers++;
  }
  return { ok: true };
}

/** Let one farmhand or seller go. Their hiring fee isn't refunded, but their wage stops. */
export function fire(kind: 'farmhand' | 'seller'): boolean {
  if (kind === 'farmhand' ? S.farmhands <= 0 : S.sellers <= 0) return false;
  if (kind === 'farmhand') S.farmhands--; else S.sellers--;
  return true;
}

