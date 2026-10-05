import { BX, BZ } from '../layout';
import { ASPECT, billboard, FARMER_FRAMES, preloadFrames, removeBillboard, screenDir, setFrame, type Billboard } from './sprites';

export type CharKind = 'player' | 'hand' | 'seller';
export interface Char {
  id: string;
  kind: CharKind;
  x: number; z: number; tx: number; tz: number;
  face: number;
  phase: number;
  state: 'idle' | 'walk' | 'work';
  act: number; actDur: number; actType: 'plant' | 'harvest' | null;
  task: { i: number } | null;
  done: boolean;
  idleT: number;
  wave: number;
  speed: number;
  /** Which painted character this is, e.g. 'boy' or 'girl', or a single-pose sprite for sellers. */
  look: string;
  /** Last horizontal screen direction, so the sprite keeps facing that way when it stops. */
  flip: boolean;
  /** True while walking away from the camera (shows the back view). */
  back: boolean;
  v: Billboard;
}

/** Sellers at the cart are the townsfolk from the character sheet, one each. */
const SELLERS = ['baker', 'grocer', 'grandma', 'oldfarmer', 'kid'];

export function mkChar(kind: CharKind, i: number): Char {
  const look = kind === 'player' ? 'farmer' : kind === 'hand' ? 'girl' : SELLERS[i % SELLERS.length];
  const first = kind === 'player' ? 'farmer-pull-0' : kind === 'hand' ? 'girl-idle' : look;
  if (kind === 'player') preloadFrames(Object.keys(ASPECT).filter(n => n.startsWith('farmer-')));
  const v = billboard(first, kind === 'player' ? 1.95 : 1.6, 0.38);
  return {
    id: kind + i, kind, x: BX[0] + 0.6 + i * 0.3, z: BZ + 2.0, tx: 0, tz: 0, face: 0, phase: Math.random() * 6, state: 'idle',
    act: 0, actDur: 0.5, actType: null, task: null, done: false, idleT: Math.random(), wave: 0,
    speed: kind === 'player' ? 5.0 : 2.7, look, flip: i % 2 === 1, back: false, v,
  };
}

export function removeChar(c: Char) { removeBillboard(c.v); }

/** Pick the frame for this moment: walk (side or back), watering when planting, basket when harvesting, wave when selling. */
export function poseChar(c: Char, t: number) {
  const v = c.v;
  v.root.position.set(c.x, 0, c.z);
  if (c.kind === 'seller') {
    // single-pose townsfolk: breathe, and hop when they make a sale
    const hop = c.wave > 0 ? Math.abs(Math.sin(t * 12)) * 0.18 : 0;
    const br = Math.sin(t * 2.4 + c.phase) * 0.015;
    setFrame(v, c.look, c.flip, 1 - br, 1 + br, hop);
    return;
  }
  if (c.look === 'farmer') { poseFarmer(c, t); return; }
  if (c.state === 'walk') {
    const d = screenDir(c.tx - c.x, c.tz - c.z);
    if (Math.abs(d.x) > 0.05) c.flip = d.x < 0;
    c.back = d.toward < -0.3 && Math.abs(d.toward) > Math.abs(d.x) * 0.5;
    const hop = Math.abs(Math.sin(c.phase)) * 0.12, sq = Math.sin(c.phase * 2) * 0.03;
    setFrame(v, c.look + (c.back ? '-back' : '-walk'), c.flip, 1 + sq, 1 - sq, hop);
    return;
  }
  if (c.state === 'work') {
    const p = c.act / c.actDur, s = Math.sin(p * Math.PI);
    if (c.actType === 'plant') setFrame(v, c.look + '-water', c.flip, 1 + s * 0.06, 1 - s * 0.08);
    else setFrame(v, c.look + (c.look === 'girl' ? '-idle' : '-walk'), c.flip, 1 - s * 0.05, 1 + s * 0.1, s * 0.15);
    return;
  }
  const br = Math.sin(t * 2.4 + c.phase) * 0.015;
  setFrame(v, c.look + (c.wave > 0 ? '-wave' : '-idle'), c.flip, 1 - br, 1 + br);
}

/**
 * The main character plays real frame animations: an 8-frame walk cycle (two steps per cycle),
 * digging and planting a seedling when planting, and pulling up a crop when harvesting.
 */
function poseFarmer(c: Char, t: number) {
  const v = c.v;
  const at = (p: number) => Math.min(FARMER_FRAMES - 1, Math.floor(p * FARMER_FRAMES));
  if (c.state === 'walk') {
    const d = screenDir(c.tx - c.x, c.tz - c.z);
    if (Math.abs(d.x) > 0.05) c.flip = d.x < 0;
    const cyc = c.phase / (Math.PI * 2);
    const f = Math.floor((cyc - Math.floor(cyc)) * FARMER_FRAMES);
    setFrame(v, `farmer-walk-${f}`, c.flip, 1, 1, Math.abs(Math.sin(c.phase)) * 0.03);
    return;
  }
  if (c.state === 'work') {
    const p = c.act / c.actDur;
    setFrame(v, `farmer-${c.actType === 'plant' ? 'plant' : 'pull'}-${at(p)}`, c.flip);
    return;
  }
  const br = Math.sin(t * 2.4 + c.phase) * 0.012;
  const hop = c.wave > 0 ? Math.abs(Math.sin(t * 10)) * 0.12 : 0;
  setFrame(v, 'farmer-pull-0', c.flip, 1 - br, 1 + br, hop);
}
