import { CROPS } from '../data/crops';
import { ANIMAL_IDS } from '../data/animals';
import { now } from './clock';
import { rotMs } from './economy';
import { SICK_AFTER_MS, animalUnlocked } from './animals';
import { timeLeft } from './staff';
import { S } from './state';

/**
 * When the farm will next need its player, for the alerts sent while they're away (online/notify.ts and
 * server/notify.ts): animals about to fall sick from hunger, and ripe crops about to rot.
 */
export type AlertKind = 'sick' | 'rot';
/** Warn this long before an animal falls sick, and before a ripe crop starts to rot. */
export const SICK_WARN_MS = 10 * 60_000, ROT_WARN_MS = 6 * 60_000;

/** When to send each alert (ms), or nothing if the farm will be fine. */
export function alertTimes(t = now()): Partial<Record<AlertKind, number>> {
  const out: Partial<Record<AlertKind, number>> = {};
  // A hungry animal falls sick SICK_AFTER_MS after it got hungry. A keeper on duty feeds them until the job ends.
  let sick = Infinity;
  for (const k of ANIMAL_IDS) {
    if (!animalUnlocked(k)) continue;
    const h = S.animals[k];
    for (let i = 0; i < h.n; i++) if (!h.sick[i] && h.ready[i] == null && h.hungry[i] != null) sick = Math.min(sick, h.hungry[i]! + SICK_AFTER_MS);
  }
  const keeper = timeLeft('keeper', t);
  if (keeper > 0 && sick < Infinity) sick = Math.max(sick, t + keeper + SICK_AFTER_MS);
  if (sick < Infinity) out.sick = Math.max(t + 60_000, sick - SICK_WARN_MS);
  // Ripe crops rot unless someone picks them; the farm manager and the drone fleet do that by themselves.
  if (!(timeLeft('manager', t) > 0) && !S.tech.includes('fleet')) {
    let rot = Infinity;
    for (const p of S.plots) {
      if (!p.crop) continue;
      const ripe = p.at + CROPS[p.crop].time * 1000;
      rot = Math.min(rot, Math.max(ripe, ripe + rotMs(p.crop) - ROT_WARN_MS));
    }
    if (rot < Infinity) out.rot = Math.max(t + 60_000, rot);
  }
  return out;
}
