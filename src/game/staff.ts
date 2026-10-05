import { CROPS, CROP_IDS } from '../data/crops';
import { ANIMAL_IDS } from '../data/animals';
import { animalUnlocked, collectAnimal, feedAnimal } from './animals';
import { clock, now } from './clock';
import { harvest, inv, plant, ripe, sell } from './economy';
import { emit, muteEvents } from './events';
import { S } from './state';
import { canFillTruck, deliverTruck } from './trucks';

/**
 * Paid staff on timed contracts. The farm manager harvests and replants ripe plots and loads trucks; the animal
 * keeper feeds the animals and collects what they make. Both keep working while the game is closed, until their
 * contract runs out (see catchUp).
 */
export type StaffId = 'manager' | 'keeper';
export interface StaffDef { name: string; lvl: number; perHour: (level: number) => number; job: string }

export const STAFF: Record<StaffId, StaffDef> = {
  manager: { name: 'Farm manager', lvl: 6, perHour: l => 60 + 18 * l, job: 'Harvests and replants ripe crops, loads trucks so you never lose a buyer, keeps your animal keeper re-hired, and sells spare crops to pay your helpers’ wages. Works while you’re away too.' },
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

export const onDuty = (k: StaffId, t = now()) => (S.staff[k] || 0) > t;
export const timeLeft = (k: StaffId, t = now()) => Math.max(0, (S.staff[k] || 0) - t);

export type HireResult = { ok: true; until: number } | { ok: false; reason: 'locked' | 'coins'; cost?: number };

/** Hire (or extend) a contract for h hours, paid up front. */
export function hireStaff(k: StaffId, h: number, t = now()): HireResult {
  if (S.level < STAFF[k].lvl) return { ok: false, reason: 'locked' };
  const c = termCost(k, h);
  if (S.coins < c) return { ok: false, reason: 'coins', cost: c };
  S.coins -= c;
  S.staff[k] = Math.max(t, S.staff[k] || 0) + h * 3600_000;
  return { ok: true, until: S.staff[k] };
}


/** One round of staff work at time t. `patient` gives the player first go at ripe crops and trucks. */
export function staffWork(t = now(), patient = true) {
  const done = { crops: 0, products: 0, trucks: 0, seeds: 0, renewed: 0 };
  if (onDuty('manager', t)) {
    S.plots.forEach((p, i) => {
      // Crops a waiting truck needs are picked at once, so the truck can be loaded before it leaves.
      const urgent = !!S.truck?.items[p.crop!];
      if (p.crop && ripe(p) && (!patient || urgent || t - (p.at + CROPS[p.crop].time * 1000) >= MANAGER_DELAY_MS)) {
        const crop = p.crop;
        done.crops += harvest(i);
        if (plant(i, crop)) done.seeds += CROPS[crop].seed;
      }
    });
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
  const sum = { crops: 0, products: 0, trucks: 0, seeds: 0 };
  const end = Math.min(to, Math.max(S.staff.manager || 0, S.staff.keeper || 0));
  if (end <= from) return sum;
  const real = clock.now;
  const step = Math.max(5000, (end - from) / 20000);
  muteEvents(true);
  try {
    for (let t = from; t <= end; t += step) {
      clock.now = () => t;
      const d = staffWork(t, false);
      sum.crops += d.crops; sum.products += d.products; sum.seeds += d.seeds;
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
      const spare = inv(c) - 10;
      if (spare > 0) sell(c, Math.min(spare, Math.ceil((due - S.coins) / CROPS[c].sell)));
    }
  }
  if (S.coins >= due) {
    S.coins -= due; owed -= due;
    if (unpaid) { unpaid = false; emit('wagesPaid', {}); }
  } else if (!unpaid) { unpaid = true; emit('wagesUnpaid', {}); }
}
