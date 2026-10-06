import * as THREE from 'three';
import { jackTree, minerRock, onDuty, timeLeft, type StaffId } from '../../game/staff';
import { lbl } from '../fx/labels';
import { DOCK, PEN } from '../layout';
import { ROCK_AT, TREE_AT } from '../world/wilds';
import { Cap, part } from './smooth';
import { buildPerson, type PersonView } from './person';

/** The animal keeper, pottering about the pen while on duty. (The manager walks the field: see ai.ts.) */

const POSTS: Partial<Record<StaffId, { x: number; z: number; face: number; title: string }>> = {
  keeper: { x: PEN.x0 + 1.7, z: PEN.z0 + 0.8, face: Math.PI / 5, title: 'Keeper' },
  // sitting in the rowboat beside the dock
  fisher: { x: DOCK.x - 2.1, z: DOCK.z1 - 0.35, face: 0.15, title: 'Fisherman' },
};
let views: Partial<Record<StaffId, PersonView>> = {};

/** The lumberjack and quarry worker walk to whatever tree or rock they are working on and swing at it. */
type Worker = 'lumberjack' | 'miner';
const WORKERS: Record<Worker, { spots: [number, number][]; target: () => number; rest: [number, number]; title: string }> = {
  lumberjack: { spots: TREE_AT, target: () => jackTree(), rest: [-9.3, -9.9], title: 'Lumberjack' },
  miner: { spots: ROCK_AT, target: () => minerRock(), rest: [11.3, -9.9], title: 'Quarry worker' },
};
const at: Record<Worker, { x: number; z: number; face: number } | null> = { lumberjack: null, miner: null };
/** Where a worker is standing, for speech bubbles; null while off duty. */
export const workerPos = (k: Worker) => (onDuty(k) && at[k] ? { x: at[k]!.x, y: 2.3, z: at[k]!.z } : null);

export function initStaffActors() {
  views = {
    keeper: buildPerson({ shirt: '#7bbf3a', pants: '#6d5844', hat: '#e7bd6c', band: '#3cc08f', hair: '#c27a3a' }),
    fisher: buildPerson({ shirt: '#ffcf3a', pants: '#2f6fd6', hat: '#ffcf3a', band: '#e2463a', hair: '#3b2416', boots: '#2f4f6e' }),
    lumberjack: buildPerson({ shirt: '#d23b2f', pants: '#34507a', hat: '#2f2f35', band: '#d23b2f', hair: '#7a3b1a', boots: '#4a2e1c' }),
    miner: buildPerson({ shirt: '#e88a2a', pants: '#5a5550', hat: '#ffd23a', band: '#ffd23a', hair: '#2b1d14', boots: '#3a3a3a' }),
  };
  at.lumberjack = at.miner = null;
  for (const k of Object.keys(views) as StaffId[]) { const v = views[k]!; v.root.visible = false; v.root.rotation.y = POSTS[k]?.face ?? 0; }
  // an axe for the lumberjack, a pickaxe for the quarry worker
  const axe = part(Cap(0.03, 0.75), '#9a6438', views.lumberjack!.arms[0], 0, -0.3, 0.3, { ol: 0.01 });
  axe.rotation.x = Math.PI / 2;
  part(new THREE.BoxGeometry(0.06, 0.22, 0.16), '#c9ced6', axe, 0, 0.4, 0.07, { ol: 0.012 });
  const pick = part(Cap(0.03, 0.75), '#9a6438', views.miner!.arms[0], 0, -0.3, 0.3, { ol: 0.01 });
  pick.rotation.x = Math.PI / 2;
  const head = part(Cap(0.035, 0.42), '#8b929c', pick, 0, 0.42, 0, { ol: 0.012 });
  head.rotation.z = Math.PI / 2;
  // the fisherman's rod, held out over the water
  const rod = part(Cap(0.025, 1.6), '#9a6438', views.fisher!.arms[0], 0, -0.3, 0.75, { ol: 0.01 });
  rod.rotation.x = 1.9;
  views.fisher!.root.scale.setScalar(1.05);
}

export const fisherPos = () => new THREE.Vector3(POSTS.fisher!.x, 0.6, POSTS.fisher!.z + 1.4);

const tmp = new THREE.Vector3();
const hm = (ms: number) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };

export function updateStaffActors(t: number) {
  for (const k of Object.keys(WORKERS) as Worker[]) updateWorker(k, t);
  for (const k of Object.keys(POSTS) as StaffId[]) {
    const v = views[k]!, on = onDuty(k), p = POSTS[k]!;
    v.root.visible = on;
    if (!on) continue;
    // Standing about: a gentle sway; the manager checks a clipboard, the keeper scatters feed now and then.
    const s = Math.sin(t * 1.6 + (k === 'keeper' ? 2 : 0));
    v.root.position.set(p.x + (k === 'keeper' ? Math.sin(t * 0.4) * 0.6 : 0), k === 'fisher' ? 0.12 + Math.sin(t * 1.6) * 0.03 : 0, p.z);
    if (k === 'fisher') {
      // seated in the boat, rod out, bobbing with the water
      v.legs[0].rotation.x = v.legs[1].rotation.x = -1.4;
      v.arms[0].rotation.set(-1.0 + Math.sin(t * 2.2) * 0.05, 0, 0.15);
      v.arms[1].rotation.set(-0.9, 0, -0.3);
      v.head.rotation.set(0.2, Math.sin(t * 0.5) * 0.2, 0);
      lbl('staff-' + k, `${p.title} · ${hm(timeLeft(k))}`, tmp.set(p.x, 2.4, p.z), 'stafftag');
      continue;
    }
    v.arms[0].rotation.set(k === 'manager' ? -1.2 : -0.4 + Math.max(0, s) * -1.2, 0, 0.15);
    v.arms[1].rotation.set(k === 'manager' ? -1.0 : 0.05 * s, 0, -0.15);
    v.head.rotation.set(k === 'manager' ? 0.25 : 0, Math.sin(t * 0.5) * 0.3, 0);
    v.basket.visible = k === 'keeper';
    lbl('staff-' + k, `${p.title} · ${hm(timeLeft(k))}`, tmp.set(v.root.position.x, 2.7, p.z), 'stafftag');
  }
}

function updateWorker(k: Worker, t: number) {
  const v = views[k]!, w = WORKERS[k], on = onDuty(k);
  v.root.visible = on;
  if (!on) { at[k] = null; return; }
  // Stand just south-east of the tree or rock, facing it; with everything down, wait by the area sign.
  const i = w.target(), [tx, tz] = i >= 0 ? w.spots[i] : w.rest;
  const gx = i >= 0 ? tx + 0.6 : tx, gz = i >= 0 ? tz + 0.55 : tz;
  const p = at[k] ??= { x: gx, z: gz, face: 0 };
  const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), walking = d > 0.05;
  if (walking) { const s = Math.min(1, 0.04 / d); p.x += dx * s; p.z += dz * s; p.face = Math.atan2(dx, dz); }
  else if (i >= 0) p.face = Math.atan2(tx - p.x, tz - p.z);
  const hop = walking ? Math.abs(Math.sin(t * 9)) * 0.08 : 0;
  v.root.position.set(p.x, hop, p.z);
  v.root.rotation.y = p.face;
  // the swing: wind up overhead, then chop down hard
  const ph = (t * 0.75 + (k === 'miner' ? 0.4 : 0)) % 1;
  const swing = walking || i < 0 ? -0.3 : ph < 0.7 ? -0.3 - 2.2 * (ph / 0.7) : -2.5 + 2.6 * ((ph - 0.7) / 0.3);
  v.arms[0].rotation.set(swing, 0, 0.1);
  v.arms[1].rotation.set(walking ? Math.sin(t * 9) * 0.5 : swing * 0.8, 0, -0.1);
  v.legs[0].rotation.x = walking ? Math.sin(t * 9) * 0.5 : 0;
  v.legs[1].rotation.x = walking ? -Math.sin(t * 9) * 0.5 : 0;
  v.upper.rotation.x = walking || i < 0 ? 0 : Math.max(0, -swing - 1.2) * -0.15 + 0.12;
  v.head.rotation.set(0.1, i < 0 ? Math.sin(t * 0.5) * 0.4 : 0, 0);
  v.basket.visible = v.hoe.visible = false;
  lbl('staff-' + k, `${w.title} · ${hm(timeLeft(k))}`, tmp.set(p.x, 2.5, p.z), 'stafftag');
}
