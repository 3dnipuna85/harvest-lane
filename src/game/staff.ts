import { MACHINES, MACHINE_IDS, recipe } from '../data/machines';
import { CROPS, CROP_IDS, type CropId } from '../data/crops';
import { ANIMAL_IDS } from '../data/animals';
import { animalUnlocked, collectAnimal, feedAnimal } from './animals';
import { clock, now } from './clock';
import { byStaff, harvest, inv, plant, ripe, sell, unlockedCrops } from './economy';
import { emit, muteEvents } from './events';
import { landCatch } from './fishing';
import { chopsOn, chopTree, hitsOn, isStump, mineRock, plantSapling, QUARRY_LVL, rockUp, ROCKS, treeOpen, treeUp, TREES, WOODS_LVL } from './resources';
import { SHOP_EVERY_MS, shopSale } from './town';
import { S } from './state';
import { canFillTruck, deliverTruck } from './trucks';

/**
 * Paid staff on timed contracts. The farm manager harvests and replants ripe plots and loads trucks; the animal
 * keeper feeds the animals and collects what they make. Both keep working while the game is closed, until their
 * contract runs out (see catchUp).
 */
export type StaffId = 'manager' | 'keeper' | 'fisher' | 'shopkeeper' | 'lumberjack' | 'miner';
export interface StaffDef { name: string; lvl: number; perHour: (level: number) => number; job: string }

export const STAFF: Record<StaffId, StaffDef> = {
  manager: { name: 'Farm manager', lvl: 6, perHour: l => 60 + 18 * l, job: 'Harvests and replants ripe crops, loads trucks so you never lose a buyer, keeps your animal keeper re-hired, and sells spare crops to pay your helpers’ wages. Works while you’re away too.' },
  fisher: { name: 'Fisherman', lvl: 3, perHour: l => 24 + 7 * l, job: 'Fishes from the rowboat and brings in a catch every 15 seconds: fish, crabs and now and then a golden fish. Works while you’re away too.' },
  shopkeeper: { name: 'Shopkeeper', lvl: 8, perHour: l => 50 + 12 * l, job: 'Runs your shop in Market Town, selling your goods and animal products for 50% more than the farm gate. Works while you’re away too.' },
  lumberjack: { name: 'Lumberjack', lvl: WOODS_LVL, perHour: l => 45 + 10 * l, job: 'Chops trees in the Woods, a swing every 12 seconds, stacks the logs in your barn for the sawmill and plants saplings on the stumps (you pay for the saplings). Works while you’re away too.' },
  miner: { name: 'Quarry worker', lvl: QUARRY_LVL, perHour: l => 60 + 12 * l, job: 'Breaks rocks in the Quarry, a swing every 12 seconds, and carts the stone to your barn for the stonecutter. Works while you’re away too.' },
  keeper: { name: 'Animal keeper', lvl: 4, perHour: l => 30 + 9 * l, job: 'Feeds your animals and collects eggs, milk, truffles and wool, even while you’re away.' },
};
export const STAFF_IDS = Object.keys(STAFF) as StaffId[];

/** Contract lengths on offer, in hours, with a discount for longer ones. */
export const TERMS: { h: number; mult: number; label: string }[] = [
  { h: 1, mult: 1, label: '1 hour' },
  { h: 8, mult: 0.85, label: '8 hours' },
  { h: 24, mult: 0.7, label: '1 day' },
];
export const termCost = (k: StaffId, h: number) => Math.round(STAFF[k].perHour(S.level) * h * (TERMS.find(x => x.h === h)?.mult ?? 1));

/** Ripe crops wait this long for the player or farmhands before the manager steps in. */
const MANAGER_DELAY_MS = 8000;
/** A waiting truck gets this long for the player to load it before the manager does. */
const TRUCK_DELAY_MS = 6000;
/** The fisherman lands one catch this often. */
const FISHER_EVERY_MS = 15000;
/** The lumberjack and quarry worker swing once this often (3 swings fell a tree, 4 break a rock). */
export const SWING_EVERY_MS = 12000;
let fishAt = 0, jackAt = 0, minerAt = 0;

/** The tree or rock a worker is busy on: one already started, else the first one standing. -1 when all are down. */
export const jackTree = (t = now()) => pick(TREES, i => treeUp(i, t), chopsOn);
export const minerRock = (t = now()) => pick(ROCKS, i => rockUp(i, t), hitsOn);
function pick(n: number, up: (i: number) => boolean, started: (i: number) => number) {
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (!up(i)) continue;
    if (started(i)) return i;
    if (first < 0) first = i;
  }
  return first;
}
let shopAt = 0;

export const onDuty = (k: StaffId, t = now()) => (S.staff[k] || 0) > t;
export const timeLeft = (k: StaffId, t = now()) => Math.max(0, (S.staff[k] || 0) - t);

/**
 * The crop the manager wants planted next: whatever the waiting truck (or the next one) asks for that the barn
 * plus the crops already growing won't cover. Null when every truck crop is covered.
 */
export function neededCrop(): CropId | null {
  if (!onDuty('manager')) return null;
  const wants = { ...(S.nextWants || {}) } as Partial<Record<string, number>>;
  if (S.truck) for (const [k, q] of Object.entries(S.truck.items)) wants[k] = (wants[k] || 0) + (q || 0);
  if (S.contract) for (const [k, q] of Object.entries(S.contract.items)) wants[k] = (wants[k] || 0) + (q || 0);
  // Goods from a machine you own need their crops planted too (the barn's stock of the good counts first).
  for (const m of MACHINE_IDS) {
    const out = MACHINES[m].out, q = (wants[out] || 0) - inv(out);
    if (!S.machines[m].owned || q <= 0) continue;
    for (const [i, n] of recipe(m)) wants[i] = (wants[i] || 0) + n * q;
  }
  for (const [k, q] of Object.entries(wants)) {
    if (!(k in CROPS)) continue;
    const c = k as CropId;
    if (CROPS[c].lvl > S.level || S.coins < CROPS[c].seed) continue;
    const growing = S.plots.filter(p => p.crop === c).length;
    if (inv(c) + growing < (q || 0)) return c;
  }
  return null;
}

export type HireResult = { ok: true; until: number } | { ok: false; reason: 'locked' | 'coins' | 'noshop'; cost?: number };

/** Hire (or extend) a contract for h hours, paid up front. */
export function hireStaff(k: StaffId, h: number, t = now()): HireResult {
  if (S.level < STAFF[k].lvl) return { ok: false, reason: 'locked' };
  if (k === 'shopkeeper' && !S.town.shop) return { ok: false, reason: 'noshop' };
  const c = termCost(k, h);
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.staff[k] = Math.max(t, S.staff[k] || 0) + h * 3600_000;
  return { ok: true, until: S.staff[k] };
}


/** One round of staff work at time t. `patient` gives the player first go at ripe crops and trucks. */
/** Helpers stop replanting a crop once the barn holds this many (unless a truck wants it): no point growing what won't sell. */
export const BARN_ENOUGH = 60;
export const worthPlanting = (c: CropId) => neededCrop() === c || inv(c) < BARN_ENOUGH;
/**
 * The seed farmhands plant: the manager's pick for the next truck, else the selected seed, else (when the barn
 * already holds plenty of that) whichever unlocked crop the barn is lowest on. Null when every crop is stocked.
 */
export function handSeed(): CropId | null {
  const n = neededCrop();
  if (n) return n;
  if (worthPlanting(S.sel)) return S.sel;
  return unlockedCrops().filter(c => inv(c) < BARN_ENOUGH && S.coins >= CROPS[c].seed).sort((a, b) => inv(a) - inv(b))[0] ?? null;
}

export function staffWork(t = now(), patient = true) {
  return byStaff(() => work(t, patient));
}
function work(t: number, patient: boolean) {
  const done = { crops: 0, products: 0, trucks: 0, seeds: 0, renewed: 0, fish: 0, shop: 0, logs: 0, stone: 0 };
  if (onDuty('manager', t)) {
    // While the game is open the manager walks the field himself (scene/actors/ai.ts); this instant version is for
    // time away, replayed by catchUp.
    if (!patient) S.plots.forEach((p, i) => {
      // Crops a waiting truck needs are picked at once, so the truck can be loaded before it leaves.
      const urgent = !!S.truck?.items[p.crop!];
      if (p.crop && ripe(p) && (!patient || urgent || t - (p.at + CROPS[p.crop].time * 1000) >= MANAGER_DELAY_MS)) {
        const crop = p.crop;
        done.crops += harvest(i);
        const next = neededCrop() ?? crop;
        if (worthPlanting(next) && plant(i, next)) done.seeds += CROPS[next].seed;
      }
    });
    // Empty plots get the crop a truck is waiting on.
    if (!patient) S.plots.forEach((p, i) => { const c = !p.crop && neededCrop(); if (c && plant(i, c)) done.seeds += CROPS[c].seed; });
    if (canFillTruck() && (!patient || t - S.truck!.arrive >= TRUCK_DELAY_MS) && deliverTruck(t)) done.trucks++;
    // He keeps the animal keeper on: a keeper you hired is re-hired for another hour just before the contract runs out.
    const kl = timeLeft('keeper', t);
    if (S.staff.keeper && kl > 0 && kl < 5 * 60_000 && S.level >= STAFF.keeper.lvl && S.coins >= termCost('keeper', 1)) {
      hireStaff('keeper', 1, t);
      done.renewed++;
    }
  }
  if (onDuty('keeper', t)) {
    for (const k of ANIMAL_IDS) {
      if (!animalUnlocked(k)) continue;
      for (let i = 0; i < S.animals[k].n; i++) {
        if (collectAnimal(k, i, t)) done.products++;
        feedAnimal(k, i, t);
      }
    }
  }
  if (onDuty('shopkeeper', t) && S.town.shop) {
    if (!shopAt || shopAt > t) shopAt = t;
    while (t - shopAt >= SHOP_EVERY_MS) { shopAt += SHOP_EVERY_MS; const c = shopSale(); if (c) { done.shop += c; } }
  } else shopAt = 0;
  if (onDuty('fisher', t)) {
    if (!fishAt || fishAt > t) fishAt = t;
    while (t - fishAt >= FISHER_EVERY_MS) { fishAt += FISHER_EVERY_MS; landCatch(); done.fish++; }
  } else fishAt = 0;
  if (onDuty('lumberjack', t)) {
    if (!jackAt || jackAt > t) jackAt = t;
    while (t - jackAt >= SWING_EVERY_MS) {
      jackAt += SWING_EVERY_MS;
      // He replants a stump first (if you can pay for the sapling), then chops.
      const stump = Array.from({ length: TREES }, (_, k) => k).find(k => treeOpen(k) && isStump(k));
      if (stump !== undefined && plantSapling(stump, t).ok) continue;
      const i = jackTree(t), had = inv('log');
      if (i >= 0 && chopTree(i, t) === 'done') done.logs += inv('log') - had;
    }
  } else jackAt = 0;
  if (onDuty('miner', t)) {
    if (!minerAt || minerAt > t) minerAt = t;
    while (t - minerAt >= SWING_EVERY_MS) {
      minerAt += SWING_EVERY_MS;
      const i = minerRock(t), had = inv('stone');
      if (i >= 0 && mineRock(i, t) === 'done') done.stone += inv('stone') - had;
    }
  } else minerAt = 0;
  return done;
}

/** Contract reminders: warn once when 10 minutes are left, and once when it ends. */
const warned: Partial<Record<StaffId, number>> = {};
export function staffTick(t = now()) {
  staffWork(t);
  for (const k of STAFF_IDS) {
    const left = timeLeft(k, t), until = S.staff[k] || 0;
    if (left > 0 && left < 10 * 60_000 && warned[k] !== until) { warned[k] = until; emit('staffEnding', { k, left }); }
    if (left === 0 && until && warned[k] !== -until && t - until < 5000) { warned[k] = -until; emit('staffEnded', { k }); }
  }
}

/**
 * Work the staff would have done while the game was closed: step through the time away (until each contract ended)
 * and run their rounds, quietly. Returns totals for a welcome-back note.
 */
export function catchUp(from: number, to = now()) {
  const sum = { crops: 0, products: 0, trucks: 0, seeds: 0, fish: 0, shop: 0, logs: 0, stone: 0 };
  const end = Math.min(to, Math.max(...STAFF_IDS.map(k => S.staff[k] || 0)));
  if (end <= from) return sum;
  const real = clock.now;
  const step = Math.max(5000, (end - from) / 20000);
  muteEvents(true);
  try {
    for (let t = from; t <= end; t += step) {
      clock.now = () => t;
      const d = staffWork(t, false);
      sum.crops += d.crops; sum.products += d.products; sum.seeds += d.seeds; sum.fish += d.fish; sum.shop += d.shop; sum.logs += d.logs; sum.stone += d.stone;
    }
  } finally { clock.now = real; muteEvents(false); }
  return sum;
}

/** Farmhands and market sellers draw a wage while they work: this much each per hour. */
export const wagePerHour = (level = S.level) => 8 + 2 * level;
let owed = 0;
/** True when the last wage couldn't be paid: helpers stop until there are coins again. */
export let unpaid = false;

export function payWages(dt: number) {
  const crew = S.farmhands + S.sellers;
  if (!crew) { unpaid = false; return; }
  owed += (crew * wagePerHour() * dt) / 3600;
  if (owed < 1) return;
  const due = Math.floor(owed);
  // Short of coins, the manager sells spare crops from the barn (cheapest first, keeping 10 of each) to pay the crew.
  if (S.coins < due && onDuty('manager')) {
    for (const c of CROP_IDS.slice().sort((a, b) => CROPS[a].sell - CROPS[b].sell)) {
      if (S.coins >= due) break;
      // one at a time: prices drop as the market fills up
      while (S.coins < due && inv(c) > 10) sell(c, 1);
    }
  }
  if (S.coins >= due) {
    S.coins -= due; owed -= due;
    if (unpaid) { unpaid = false; emit('wagesPaid', {}); }
  } else if (!unpaid) { unpaid = true; emit('wagesUnpaid', {}); }
}
