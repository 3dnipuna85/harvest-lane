import { MACHINE_IDS } from '../data/machines';
import { now } from './clock';
import { earn, gainXP, hands, xpNeed } from './economy';
import { gainGems } from './estate';
import { emit, on } from './events';
import { WOODS_LVL } from './resources';
import { live } from './live';
import { S, type Goal, type GoalKind } from './state';

/**
 * Level targets. Every level brings two targets and one timed challenge with a countdown. Only your own work
 * counts (staff don't). Targets pay coins and XP; the timed challenge pays diamonds. A missed challenge is replaced
 * by a new one a few minutes later, and so is a finished one, so there is always something to race for.
 */

export const GOAL_TEXT: Record<GoalKind, (n: number) => string> = {
  harvest: n => `Harvest ${n} crops`,
  order: n => `Deliver ${n} orders`,
  animal: n => `Collect ${n} animal goods`,
  truck: n => `Load ${n} truck${n > 1 ? 's' : ''} yourself`,
  fish: n => `Catch ${n} fish`,
  make: n => `Make ${n} workshop goods`,
  gather: n => `Chop or dig ${n} logs or stone`,
};
export const GOAL_ICON: Record<GoalKind, string> = { harvest: '🌾', order: '📋', animal: '🥚', truck: '🚚', fish: '🐟', make: '🍞', gather: '🪓' };

const SIZE: Record<GoalKind, (l: number) => number> = {
  harvest: l => 20 + 8 * l,
  order: l => 2 + Math.floor(l / 4),
  animal: l => 6 + 2 * l,
  truck: l => 1 + Math.floor(l / 8),
  fish: l => 3 + Math.floor(l / 5),
  make: l => 4 + Math.floor(l / 2),
  gather: l => 6 + Math.floor(l / 3),
};

/** A new timed challenge comes this long after you beat the last one, and longer after you miss one. */
export const TIMED_GAP_MS = 3 * 60_000;
export const FAILED_GAP_MS = 10 * 60_000;
/** Diamonds to start the next challenge right away instead of waiting. */
export const SKIP_GEMS = 3;
/** Nearly out of time but close: buy 5 more minutes, once per challenge. */
export const EXTEND_MS = 5 * 60_000, EXTEND_GEMS = 2;
export function canExtend(t = now()) {
  const c = S.goals?.list[2];
  return !!c && c.state === 'open' && !c.ext && c.until - t < 2 * 60_000 && c.until > t && c.have >= c.n / 2;
}
export function extendChallenge(pay: 'ad' | 'gems', t = now()) {
  if (!canExtend(t)) return false;
  if (pay === 'gems') { if (S.gems < EXTEND_GEMS) return false; S.gems -= EXTEND_GEMS; }
  const c = S.goals!.list[2];
  c.ext = true;
  c.until += EXTEND_MS;
  return true;
}
export const timedMin = (l: number) => Math.min(15, 8 + Math.floor(l / 5));

export function goalKinds(level = S.level): GoalKind[] {
  const k: GoalKind[] = ['harvest', 'order', 'animal'];
  if (level >= 2) k.push('truck');
  if (level >= 3) k.push('fish');
  if (MACHINE_IDS.some(m => S.machines[m].owned)) k.push('make');
  if (level >= WOODS_LVL) k.push('gather');
  return k;
}

const pickOut = (from: GoalKind[], rand: () => number) => from.splice(Math.floor(rand() * from.length), 1)[0];

function target(kind: GoalKind, l: number): Goal {
  return { kind, n: SIZE[kind](l), have: 0, coins: 60 + 35 * l, xp: Math.round(xpNeed(l) * 0.08), gems: 0, until: 0, state: 'open' };
}
function timed(kind: GoalKind, l: number, t: number): Goal {
  return { kind, n: Math.max(1, Math.round(SIZE[kind](l) * 0.4)), have: 0, coins: 30 + 20 * l, xp: 0, gems: 2 + Math.floor(l / 10), until: t + timedMin(l) * 60_000, state: 'open' };
}

/** Rush levels: every few levels the two main targets get a timer as well, and pay half as much again. */
export const isRush = (l = S.level) => live.rushEvery > 0 && l >= live.rushEvery && l % live.rushEvery === 0;
export const RUSH_RETRY_MS = 5 * 60_000;
const rushMs = () => live.rushMin * 60_000;

/** A fresh set for this level: two targets and a timed challenge, each a different kind. */
export function newGoals(t = now(), rand = Math.random) {
  const pool = goalKinds();
  const a = pickOut(pool, rand), b = pickOut(pool, rand), c = pickOut(pool, rand);
  const main = [target(a, S.level), target(b, S.level)];
  if (isRush()) for (const g of main) { g.until = t + rushMs(); g.coins = Math.round(g.coins * 1.5); g.xp = Math.round(g.xp * 1.5); }
  S.goals = { lvl: S.level, list: [...main, timed(c, S.level, t)], nextTimed: 0 };
}

/** Start a missed rush target again, from zero with a full timer (after the wait, an ad, or diamonds). */
export function restartTarget(i: number, pay: 'wait' | 'ad' | 'gems', t = now()) {
  const g = S.goals?.list[i];
  if (!g || i > 1 || g.state !== 'failed') return false;
  if (pay === 'wait' && t < (g.retryAt ?? 0)) return false;
  if (pay === 'gems') { if (S.gems < SKIP_GEMS) return false; S.gems -= SKIP_GEMS; }
  g.state = 'open'; g.have = 0; g.until = t + rushMs(); delete g.retryAt;
  return true;
}

export function goalsTick(t = now(), rand = Math.random) {
  if (!S.goals || S.goals.lvl !== S.level) { newGoals(t, rand); return; }
  const g = S.goals, ch = g.list[2];
  for (const [i, x] of g.list.slice(0, 2).entries()) {
    if (x.until && x.state === 'open' && t >= x.until) { x.state = 'failed'; x.retryAt = t + RUSH_RETRY_MS; emit('goalFailed', { kind: x.kind, rush: true }); }
    else if (x.state === 'failed' && t >= (x.retryAt ?? 0)) restartTarget(i, 'wait', t);
  }
  if (ch.state === 'open' && t >= ch.until) {
    ch.state = 'failed';
    g.nextTimed = t + FAILED_GAP_MS;
    emit('goalFailed', { kind: ch.kind });
  } else if (ch.state !== 'open' && t >= g.nextTimed) {
    const pool = goalKinds().filter(k => k !== g.list[0].kind && k !== g.list[1].kind);
    g.list[2] = timed(pickOut(pool.length ? pool : goalKinds(), rand), S.level, t);
  }
}

/** Waiting for the next challenge, and how long. */
export const challengeWait = (t = now()) => (S.goals && S.goals.list[2].state !== 'open' ? Math.max(0, S.goals.nextTimed - t) : 0);

/** Start the next challenge now (after watching an ad, or for diamonds). */
export function skipWait(pay: 'ad' | 'gems', t = now()) {
  if (!S.goals || S.goals.list[2].state === 'open') return false;
  if (pay === 'gems') { if (S.gems < SKIP_GEMS) return false; S.gems -= SKIP_GEMS; }
  S.goals.nextTimed = t;
  goalsTick(t);
  return true;
}

/** Can this finished target's reward still be doubled? */
export const canDouble = (i: number) => { const g = S.goals?.list[i]; return !!g && g.state === 'done' && !g.dbl && (g.coins > 0 || g.gems > 0); };
/** Pay a finished target's coins and diamonds again (after watching an ad). XP isn't doubled. */
export function doubleGoal(i: number) {
  if (!canDouble(i)) return false;
  const g = S.goals!.list[i];
  g.dbl = true;
  earn(g.coins);
  gainGems(g.gems, 'goal');
  return true;
}

/** Count some of your own work towards the open targets of that kind. */
export function progress(kind: GoalKind, n = 1, t = now()) {
  if (hands.staff || !S.goals || S.goals.lvl !== S.level) return;
  S.goals.list.forEach((g, i) => {
    if (g.state !== 'open' || g.kind !== kind || (g.until && t >= g.until)) return;
    g.have = Math.min(g.n, g.have + n);
    if (g.have < g.n) return;
    g.state = 'done';
    if (i === 2) S.goals!.nextTimed = t + TIMED_GAP_MS;
    earn(g.coins);
    gainGems(g.gems, 'goal');
    emit('goalDone', { kind: g.kind, n: g.n, coins: g.coins, xp: g.xp, gems: g.gems, timed: !!g.until });
    // XP last: it can level you up, which brings the next level's targets.
    gainXP(g.xp);
  });
}

let bound = false;
export function bindGoals() {
  if (bound) return;
  bound = true;
  on('harvest', ({ n }) => progress('harvest', n));
  on('orderDone', () => progress('order'));
  on('animalCollect', () => progress('animal'));
  on('truckDone', () => progress('truck'));
  on('fishCaught', ({ byPlayer }) => { if (byPlayer) progress('fish'); });
  on('machineDone', () => progress('make'));
  on('treeFelled', ({ n }) => progress('gather', n));
  on('rockBroken', ({ n }) => progress('gather', n));
  on('crystalBroken', ({ stone }) => progress('gather', stone));
}
