import * as THREE from 'three';
import { ANIMAL_IDS, type AnimalId } from '../../data/animals';
import { hands as staffHands } from '../../game/economy';
import { on } from '../../game/events';
import { S, visiting } from '../../game/state';
import { crew } from '../actors/ai';
import { animalPos } from '../actors/animals';
import { dogAt } from '../actors/dog';
import type { Char } from '../actors/person';
import { lbl } from './labels';

/**
 * Funny speech bubbles. Every so often someone on the farm says something silly, and big moments get a
 * reaction (double harvests, rotten crops, sick animals, unpaid wages, level-ups). One or two bubbles at a time.
 */
type Pos = () => { x: number; z: number; y: number } | null;
interface Bubble { key: string; at: Pos; text: string; cls: string; until: number }

const LINES = {
  player: [
    'Ahh, the smell of fresh soil… and cow.', '“Farming is easy,” said nobody ever.', 'Today I get rich! Or at least less poor.',
    'Note to self: buy more seeds. And a hat that fits.', 'I should name the chickens. Nugget? …No, too soon.',
    'If I stare at the crops, do they grow faster?', 'One day this will all be an empire. A muddy empire.',
  ],
  hand: [
    'These carrots won’t pull themselves!', 'I talk to the tomatoes. They don’t talk back. Yet.', 'Is it lunch yet? It feels like lunch.',
    'My back says “tea break”.', 'I planted a joke once. It grew corny. 🌽', 'Who keeps leaving hay in my boots?',
    'One more row… then another one more row.', 'I’m outstanding in my field. Literally.',
  ],
  seller: [
    'Fresh! Fresher than fresh!', 'Buy two, get… two!', 'Best prices this side of the river!', 'Psst… the popcorn is the good stuff.',
    'Hand-picked with love and only a little dirt!', 'Come closer, the bread won’t bite!',
  ],
  manager: [
    'Clipboard says: work harder. Clipboard is always right.', 'I see a truck coming. I also see empty plots.',
    'Efficiency! Synergy! …Snacks?', 'Who left a rake on the path? Again?', 'I manage. It’s in the name.',
  ],
  hen: ['Bawk! 🥚', 'Did someone say breakfast?', 'I lay eggs, not miracles.', 'Bok bok… is that corn?', 'Which came first? Me. Obviously.'],
  cow: ['Moo. (Translation: pay me in wheat.)', 'Mooo-ve over, I’m grazing here.', 'I’m not fat, I’m full of milk.', 'Udderly bored. 🐄'],
  pig: ['Oink! Mud spa time.', 'Truffles? Never heard of them. 🐷', 'I’m not messy, I’m camouflaged.'],
  sheep: ['Baa. Don’t you dare shear me in winter.', 'Having a woolly good day.', 'Ewe talking to me?'],
  dog: ['Woof! (I guarded the farm. From a butterfly.)', 'Woof woof! Ball? BALL?', 'Grr… that chicken looked at me funny.'],
};
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const bubbles: Bubble[] = [];
let nextIdle = performance.now() + 12000;

const charAt = (c: Char | null | undefined, y = 2.2): Pos => () => (c ? { x: c.x, z: c.z, y } : null);
const animalAt = (k: AnimalId, i: number): Pos => () => { const p = animalPos(k, i); return p.lengthSq() ? { x: p.x, z: p.z, y: k === 'hen' ? 1.1 : 1.9 } : null; };

export function say(key: string, at: Pos, text: string, cls = '', secs = 3.6) {
  if (bubbles.some(b => b.key === key)) return;
  if (bubbles.length >= 2) bubbles.shift();
  bubbles.push({ key, at, text, cls, until: performance.now() + secs * 1000 });
}

/** Someone random says something silly. */
function idleLine() {
  const c = crew(), opts: [string, Pos, string][] = [];
  if (c.player) opts.push(['p', charAt(c.player), pick(LINES.player)]);
  c.hands.forEach((h, i) => opts.push(['h' + i, charAt(h), pick(LINES.hand)]));
  if (S.sellers) c.sellers.forEach((h, i) => opts.push(['s' + i, charAt(h), pick(LINES.seller)]));
  if (c.manager) opts.push(['m', charAt(c.manager), pick(LINES.manager)]);
  for (const k of ANIMAL_IDS) for (let i = 0; i < Math.min(2, S.animals[k].n); i++) opts.push(['a' + k + i, animalAt(k, i), pick(LINES[k])]);
  const d = dogAt();
  if (d) opts.push(['dog', () => { const p = dogAt(); return p ? { ...p, y: 1.0 } : null; }, pick(LINES.dog)]);
  if (opts.length) { const [k, at, text] = pick(opts); say(k, at, text); }
}

const tmp = new THREE.Vector3();
export function updateChatter() {
  const now = performance.now();
  if (!visiting && now > nextIdle) { idleLine(); nextIdle = now + 14000 + Math.random() * 12000; }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i], p = b.at();
    if (now > b.until || !p) { bubbles.splice(i, 1); continue; }
    lbl('chat-' + b.key, b.text, tmp.set(p.x, p.y, p.z), 'say chat ' + b.cls);
  }
}

let bound = false;
export function bindChatter() {
  bubbles.length = 0;
  if (bound) return;
  bound = true;
  const me = () => charAt(crew().player);
  const aHand = () => { const h = crew().hands; return h.length ? h[Math.floor(Math.random() * h.length)] : null; };
  on('harvest', ({ n }) => { if (n > 1 && !staffHands.staff && Math.random() < 0.5) say('p', me(), pick(['Double harvest! 🎉', 'Two for one! I’m a genius.', 'Bonus veggie! Don’t tell the tax man.']), 'happy'); });
  on('cropRotted', () => say('p', me(), pick(['Eww… that smells like old socks.', 'Note to self: harvest BEFORE it turns into soup.', 'Well, the worms are happy.']), 'angry'));
  on('animalSick', ({ kind, i }) => say('a' + kind + i, animalAt(kind, i), pick(['Achoo! 🤧', 'I don’t feel so good…', 'Feed me… or call the vet…']), 'angry', 4));
  on('wagesUnpaid', () => { const h = aHand(); if (h) say('wage', charAt(h), pick(['No coins, no carrots! 😤', 'We’re on strike until payday!', 'I work for coins, not compliments!']), 'angry', 4.5); });
  on('wagesPaid', () => { const h = aHand(); if (h) say('wage', charAt(h), 'Payday! Back to work! 💪', 'happy'); });
  on('levelUp', () => say('p', me(), pick(['I’m getting good at this!', 'Level up! Somebody get me a trophy.', 'Look at me, a real farmer now!']), 'happy'));
  on('fishCaught', ({ kind, byPlayer }) => { if (byPlayer && kind === 'goldfish') say('p', me(), 'A GOLDEN fish?! Nobody will believe me!', 'happy', 4); });
  on('treeFelled', () => { if (Math.random() < 0.4) say('p', me(), pick(['TIMBERRR! 🌲', 'Sorry, tree. It’s for a good cause.', 'Who needs a gym when you have an axe?']), 'happy'); });
  on('rockBroken', () => { if (Math.random() < 0.4) say('p', me(), pick(['Rock solid profit! 🪨', 'My arms are now 80% stone.', 'Take that, rock!']), 'happy'); });
  on('machineDone', () => { if (Math.random() < 0.12) say('p', me(), pick(['Mmm, smells like money.', 'Fresh out of the machine!', 'That machine works harder than I do.'])); });
}
