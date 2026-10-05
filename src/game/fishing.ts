import type { ProductId } from '../data/goods';
import { now } from './clock';
import { add, gainXP } from './economy';
import { emit } from './events';
import { S } from './state';

/** Seconds until a fish bites after casting, and how long the bite lasts before it gets away. */
export const BITE_WAIT_S = [2.5, 7] as const;
export const BITE_WINDOW_S = 1.8;
/** What a catch can be, with its odds and XP. */
export const CATCH: { kind: ProductId; p: number; xp: number }[] = [
  { kind: 'fish', p: 0.7, xp: 1 },
  { kind: 'crab', p: 0.24, xp: 3 },
  { kind: 'goldfish', p: 0.06, xp: 10 },
];

export type FishState = 'idle' | 'wait' | 'bite';
/** The line in the water. Not saved: closing the game reels it in. */
export const line = { state: 'idle' as FishState, biteAt: 0, biteEnd: 0 };

export function resetFishing() { line.state = 'idle'; }

/** Cast the line. A fish bites a few seconds later. */
export function cast(t = now(), rand = Math.random): boolean {
  if (line.state !== 'idle') return false;
  line.state = 'wait';
  line.biteAt = t + (BITE_WAIT_S[0] + rand() * (BITE_WAIT_S[1] - BITE_WAIT_S[0])) * 1000;
  emit('fishCast', {});
  return true;
}

export function fishTick(t = now()) {
  if (line.state === 'wait' && t >= line.biteAt) {
    line.state = 'bite';
    line.biteEnd = t + BITE_WINDOW_S * 1000;
    emit('fishBite', {});
  } else if (line.state === 'bite' && t > line.biteEnd) {
    line.state = 'idle';
    emit('fishMissed', { early: false });
  }
}

/** Reel in: lands a catch during a bite, otherwise comes up empty. */
export function reel(t = now(), rand = Math.random): ProductId | null {
  if (line.state === 'idle') return null;
  if (line.state === 'wait' || t > line.biteEnd) {
    line.state = 'idle';
    emit('fishMissed', { early: true });
    return null;
  }
  line.state = 'idle';
  return landCatch(rand, true);
}

/** Roll a catch and put it in the barn. `byPlayer` is false for the hired fisherman. */
export function landCatch(rand = Math.random, byPlayer = false): ProductId {
  let r = rand(), pick = CATCH[0];
  for (const c of CATCH) { if (r < c.p) { pick = c; break; } r -= c.p; }
  add(pick.kind, 1);
  S.made[pick.kind] = (S.made[pick.kind] || 0) + 1;
  S.stats.fish++;
  gainXP(pick.xp);
  emit('fishCaught', { kind: pick.kind, byPlayer });
  return pick.kind;
}

/** Walk away from the water without a fuss. */
export function stopFishing() { line.state = 'idle'; }
