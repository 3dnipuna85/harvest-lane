import { PEN, ROADZ } from '../layout';
import { billboard, screenDir, setFrame, type Billboard } from './sprites';

/** Painted farm animals that wander: hens with chicks along the road, cows, a pig and a sheep in the pen. */
interface Animal {
  kind: 'hen' | 'chick' | 'cow' | 'pig' | 'sheep';
  x: number; z: number; tx: number; tz: number;
  t: number; phase: number; flip: boolean;
  speed: number;
  /** Chicks follow this animal. */
  mom?: Animal;
  v: Billboard;
}

let animals: Animal[] = [];

const H = { hen: 0.75, chick: 0.38, cow: 1.35, pig: 0.95, sheep: 1.0 };
const SPEED = { hen: 1.2, chick: 1.6, cow: 0.6, pig: 0.7, sheep: 0.6 };
const FRAME = { hen: 'hen-walk', chick: 'chick', cow: 'cow-side', pig: 'pig', sheep: 'sheep' };

function make(kind: Animal['kind'], x: number, z: number, mom?: Animal): Animal {
  const v = billboard(FRAME[kind], H[kind], kind === 'cow' ? 0.7 : kind === 'chick' ? 0.16 : 0.32);
  return { kind, x, z, tx: x, tz: z, t: Math.random() * 3, phase: Math.random() * 6, flip: Math.random() < 0.5, speed: SPEED[kind], mom, v };
}

export function initAnimals() {
  animals = [];
  for (let i = 0; i < 3; i++) {
    const hen = make('hen', -5 + i * 4, ROADZ + (i - 1) * 0.3);
    animals.push(hen);
    if (i !== 1) for (let k = 0; k < 2; k++) animals.push(make('chick', hen.x - 0.4 - k * 0.3, hen.z + 0.3, hen));
  }
  animals.push(make('cow', PEN.x0 + 1.2, PEN.z0 + 1.3), make('cow', PEN.x0 + 2.5, PEN.z0 + 2.9), make('pig', PEN.x0 + 1.4, PEN.z1 - 1.0));
}

function pickTarget(a: Animal) {
  if (a.kind === 'hen') {
    a.t = 1.5 + Math.random() * 3;
    if (Math.random() < 0.6) { a.tx = -11 + Math.random() * 19; a.tz = ROADZ - 0.6 + Math.random() * 1.2; }
    else { a.tx = 8.6 + Math.random() * 2.2; a.tz = 4 + Math.random() * 4.5; }
  } else {
    a.t = 3 + Math.random() * 4;
    a.tx = PEN.x0 + 0.8 + Math.random() * (PEN.x1 - PEN.x0 - 1.6);
    a.tz = PEN.z0 + 0.9 + Math.random() * (PEN.z1 - PEN.z0 - 1.8);
  }
}

export function updateAnimals(dt: number, t: number) {
  for (const a of animals) {
    a.t -= dt;
    if (a.mom) { a.tx = a.mom.x - 0.45; a.tz = a.mom.z + 0.35; }
    else if (a.t <= 0) pickTarget(a);
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    const moving = d > (a.mom ? 0.25 : 0.05);
    if (moving) {
      const s = Math.min(d, a.speed * dt * (a.mom && d > 1 ? 2 : 1));
      a.x += (dx / d) * s; a.z += (dz / d) * s;
      a.phase += dt * (a.kind === 'cow' ? 7 : 16);
      const sd = screenDir(dx, dz);
      if (Math.abs(sd.x) > 0.02) a.flip = sd.x < 0;
    }
    a.v.root.position.set(a.x, 0, a.z);
    const hop = moving ? Math.abs(Math.sin(a.phase)) * (a.kind === 'cow' ? 0.03 : 0.07) : 0;
    let frame: string = FRAME[a.kind];
    if (a.kind === 'hen' && !moving && Math.sin(a.t * 3) > 0.2) frame = 'hen-peck';
    if (a.kind === 'cow' && !moving && Math.sin(t * 0.3 + a.phase) > 0.4) frame = 'cow-front';
    const br = moving ? 0 : Math.sin(t * 2 + a.phase) * 0.02;
    setFrame(a.v, frame, a.flip, 1 - br * 0.5, 1 + br, hop);
  }
}
