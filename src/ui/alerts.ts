import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { animalState, animalUnlocked, sickIn } from '../game/animals';
import { on } from '../game/events';
import { S, visiting } from '../game/state';
import { toast } from './toasts';

/** In-game alerts: a warning a few minutes before a hungry animal falls sick, and a note when one does. */
const WARN_MS = 5 * 60_000;
let warned = new Set<string>(), sickToastAt = 0, checkAt = 0;

export function bindAlerts() {
  on('animalSick', ({ kind }) => {
    if (visiting || performance.now() - sickToastAt < 30_000) return;
    sickToastAt = performance.now();
    toast(`🤒 A ${ANIMALS[kind].name.toLowerCase()} fell sick from hunger. The vet in town can treat it.`);
  });
}

/** Called every frame; looks at the herds every few seconds. */
export function updateAlerts() {
  const t = performance.now();
  if (visiting || t < checkAt) return;
  checkAt = t + 4000;
  const soon: AnimalId[] = [];
  for (const k of ANIMAL_IDS) {
    if (!animalUnlocked(k)) continue;
    for (let i = 0; i < S.animals[k].n; i++) {
      const id = k + i, left = animalState(k, i) === 'hungry' ? sickIn(k, i) : Infinity;
      if (left > WARN_MS) { warned.delete(id); continue; }
      if (left > 0 && !warned.has(id)) { warned.add(id); if (!soon.includes(k)) soon.push(k); }
    }
  }
  if (soon.length) toast(`⚠️ Your ${soon.map(k => ANIMALS[k].plural.toLowerCase()).join(' and ')} are hungry and will fall sick in a few minutes. Feed them!`);
}

/** Forget warnings (new farm or signed in to another one). */
export const resetAlerts = () => { warned = new Set(); };
