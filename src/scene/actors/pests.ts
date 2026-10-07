import * as THREE from 'three';
import { now } from '../../game/clock';
import { on } from '../../game/events';
import { S } from '../../game/state';
import { FOX_HP, FOX_MS } from '../../game/troubles';
import { ctx } from '../context';
import { dust3 } from '../fx/particles';
import { lbl } from '../fx/labels';
import { PEN, plotPos } from '../layout';
import { Cap, Cone, Sph, part } from './smooth';

/** Crows that land on your crops and a fox that sneaks up to the hen house (game/troubles.ts). Tap to chase them. */

interface Crow { g: THREE.Group; wings: THREE.Group[]; i: number; flee: number; x: number; z: number; ph: number }
let crows: Crow[] = [];
let fox: { g: THREE.Group; legs: THREE.Group[]; tail: THREE.Group; x: number; z: number; flee: number; hop: number } | null = null;
let bound = false;
const tmp = new THREE.Vector3();
// up from the pond, south-west of the pen, to the hen house fence
const FOX_FROM = { x: -14, z: 9.5 }, FOX_TO = { x: PEN.x0 + 1.6, z: PEN.z1 + 0.6 };

function buildCrow(i: number): Crow {
  const g = new THREE.Group(), ink = '#2a2733', sheen = '#3d3a4f';
  part(Sph(0.2), ink, g, 0, 0.3, 0, { s: [0.85, 0.8, 1.25], ol: 0.02 });
  part(Sph(0.13), ink, g, 0, 0.47, 0.19, { ol: 0.018 });
  part(Cone(0.05, 0.16, 12), '#f0b030', g, 0, 0.45, 0.35, { r: [Math.PI / 2, 0, 0], ol: 0.01 });
  for (const s of [-1, 1]) {
    part(Sph(0.03), '#ffffff', g, 0.07 * s, 0.51, 0.28, { ol: false, shadow: false });
    part(Sph(0.016), '#000000', g, 0.075 * s, 0.515, 0.305, { ol: false, shadow: false });
  }
  part(Cone(0.12, 0.3, 12), sheen, g, 0, 0.3, -0.3, { r: [-Math.PI / 2 - 0.3, 0, 0], ol: 0.015 });
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(0.15 * s, 0.36, 0); g.add(w);
    part(Sph(0.16), sheen, w, 0.06 * s, 0, -0.04, { s: [0.35, 0.7, 1.2], ol: 0.014 });
    wings.push(w);
  }
  for (const s of [-1, 1]) part(Cap(0.015, 0.12), '#f0b030', g, 0.07 * s, 0.08, 0.02, { ol: false });
  g.scale.setScalar(1.35);
  g.userData = { type: 'crow', i };
  ctx.scene.add(g); ctx.pickables.push(g);
  const q = plotPos(i);
  return { g, wings, i, flee: 0, x: q.x + (Math.random() - 0.5) * 0.8, z: q.z + (Math.random() - 0.5) * 0.8, ph: Math.random() * 6 };
}

function buildFox() {
  const g = new THREE.Group(), fur = '#e8792e', cream = '#fff1df', dark = '#3a2418';
  part(Cap(0.2, 0.42), fur, g, 0, 0.42, 0, { r: [Math.PI / 2, 0, 0], ol: 0.022 });
  part(Sph(0.15), cream, g, 0, 0.36, 0.18, { s: [0.9, 0.8, 1.2], ol: false, shadow: false });
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.22], [0.11, -0.22]]) {
    const p = new THREE.Group(); p.position.set(x, 0.3, z); g.add(p);
    part(Cap(0.055, 0.16), dark, p, 0, -0.13, 0, { ol: 0.014 });
    legs.push(p);
  }
  const head = new THREE.Group(); head.position.set(0, 0.66, 0.36); g.add(head);
  part(Sph(0.2), fur, head, 0, 0, 0, { ol: 0.02 });
  part(Cone(0.1, 0.24, 14), cream, head, 0, -0.05, 0.2, { r: [Math.PI / 2, 0, 0], ol: 0.014 });
  part(Sph(0.04), dark, head, 0, -0.05, 0.33, { ol: false });
  for (const s of [-1, 1]) {
    part(Cone(0.08, 0.2, 12), fur, head, 0.12 * s, 0.2, -0.02, { r: [0, 0, -0.3 * s], ol: 0.014 });
    part(Sph(0.035), dark, head, 0.08 * s, 0.06, 0.16, { ol: false, shadow: false });
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.5, -0.36); g.add(tail);
  part(Sph(0.16), fur, tail, 0, 0.05, -0.2, { s: [0.8, 0.8, 1.7], ol: 0.016 });
  part(Sph(0.08), cream, tail, 0, 0.07, -0.44, { ol: 0.01 });
  g.userData = { type: 'fox' };
  g.scale.setScalar(1.15);
  ctx.scene.add(g); ctx.pickables.push(g);
  return { g, legs, tail, x: FOX_FROM.x, z: FOX_FROM.z, flee: 0, hop: 0 };
}

const drop = (g: THREE.Object3D) => { ctx.scene.remove(g); const k = ctx.pickables.indexOf(g); if (k >= 0) ctx.pickables.splice(k, 1); };

export function initPests() {
  crows = []; fox = null;
  if (bound) return;
  bound = true;
  on('crowShooed', ({ i }) => { const c = crows.find(x => x.i === i && !x.flee); if (c) c.flee = 0.001; });
  on('cropEaten', ({ i }) => { const c = crows.find(x => x.i === i && !x.flee); if (c) c.flee = 0.001; });
  on('foxHit', ({ left }) => { if (fox) { fox.hop = 0.35; dust3(fox.x, fox.z); if (left <= 0) fox.flee = 0.001; } });
  on('foxStole', () => { if (fox) fox.flee = 0.001; });
}

export function updatePests(dt: number, t: number) {
  const tr = S.trouble, tn = now();
  // crows: one per entry still waiting; leftovers fly off
  const want = tr?.kind === 'crows' ? tr.crows! : [];
  for (const w of want) if (!crows.some(c => c.i === w.i && !c.flee)) crows.push(buildCrow(w.i));
  for (const c of crows) {
    if (!c.flee && !want.some(w => w.i === c.i)) c.flee = 0.001;
    if (c.flee) {
      c.flee += dt;
      c.g.position.set(c.x + c.flee * 3, 0.3 + c.flee * 4, c.z - c.flee * 2);
      for (const [k, w] of c.wings.entries()) w.rotation.z = (k ? -1 : 1) * Math.sin(t * 30) * 1.1;
      continue;
    }
    // hop and peck at the crop
    const peck = Math.max(0, Math.sin(t * 5 + c.ph));
    c.g.position.set(c.x, 0.32 + Math.abs(Math.sin(t * 2.5 + c.ph)) * 0.05, c.z);
    c.g.rotation.set(peck * 0.5, Math.sin(t * 0.7 + c.ph) * 0.8, 0);
    for (const [k, w] of c.wings.entries()) w.rotation.z = (k ? -1 : 1) * (0.1 + peck * 0.2);
    const left = want.find(w => w.i === c.i)!.at - tn;
    if (left < 10_000) lbl('crow' + c.i, `${Math.ceil(left / 1000)}`, tmp.set(c.x, 1.2, c.z), 'pestclock');
  }
  crows = crows.filter(c => { if (c.flee > 1.5) { drop(c.g); return false; } return true; });

  // the fox
  if (tr?.kind === 'fox' && !fox) fox = buildFox();
  if (!fox) return;
  if (!fox.flee && tr?.kind !== 'fox') fox.flee = 0.001;
  let speed = 0, face = 0;
  if (fox.flee) {
    fox.flee += dt; speed = 7; fox.x -= speed * dt * 0.6; fox.z += speed * dt * 0.8; face = Math.atan2(-0.6, 0.8);
    if (fox.flee > 2.5) { drop(fox.g); fox = null; return; }
  } else {
    // creeps from the trees to the hen house over FOX_MS
    const k = Math.min(1, (tn - tr!.start) / (FOX_MS * 0.7));
    const nx = FOX_FROM.x + (FOX_TO.x - FOX_FROM.x) * k, nz = FOX_FROM.z + (FOX_TO.z - FOX_FROM.z) * k;
    speed = Math.hypot(nx - fox.x, nz - fox.z) / Math.max(dt, 1e-3);
    fox.x = nx; fox.z = nz; face = Math.atan2(FOX_TO.x - FOX_FROM.x, FOX_TO.z - FOX_FROM.z);
    lbl('fox', `🦊 ${'❤'.repeat(Math.max(0, tr!.hp ?? FOX_HP))} · ${Math.max(0, Math.ceil((tr!.start + FOX_MS - tn) / 1000))}s`, tmp.set(fox.x, 1.6, fox.z), 'pestclock');
  }
  fox.hop = Math.max(0, fox.hop - dt);
  const run = speed > 0.2 ? t * 14 : 0;
  fox.g.position.set(fox.x, Math.sin((fox.hop / 0.35) * Math.PI) * 0.4, fox.z);
  fox.g.rotation.y = face;
  fox.legs.forEach((l, k) => { l.rotation.x = run ? Math.sin(run + (k % 2 ? Math.PI : 0) + (k > 1 ? 1 : 0)) * 0.7 : 0; });
  fox.tail.rotation.y = Math.sin(t * 6) * 0.4;
}
