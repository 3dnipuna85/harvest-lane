import * as THREE from 'three';
import { now } from '../../game/clock';
import { on } from '../../game/events';
import { APPLE_REGROW_MS, CAVE_HITS, CAVE_LVL, ORCHARD_LVL, appleRipe, caveHitsOn, crystalUp } from '../../game/areas';
import { S } from '../../game/state';
import { ctx } from '../context';
import { lbl, toScreen } from '../fx/labels';
import { fx } from '../../ui/toasts';
import { dust3, sparkle } from '../fx/particles';
import { Cone, Cyl, Sph, part } from '../geometry';
import { T } from '../materials';

/** Across the river: the Apple Orchard (south-west) and the Crystal Cave (south-east), found past level 21. */
export const APPLE_AT: [number, number][] = [[-15.0, 17.6], [-12.4, 17.5], [-9.8, 17.7], [-7.2, 17.5], [-13.7, 19.9], [-11.1, 20.0], [-8.5, 19.8], [-5.9, 20.0]];
export const CRYSTAL_AT: [number, number][] = [[8.4, 17.9], [10.3, 17.4], [12.2, 17.9], [14.1, 17.4], [16.0, 17.9]];
export const ORCHARD_C: [number, number] = [-10.5, 18.8];
export const CAVE_C: [number, number] = [12.2, 19.2];

interface Spot { g: THREE.Group; fruit: THREE.Group; shake: number; was: string | null }
let trees: Spot[] = [], rocks: Spot[] = [];

function appleTree(i: number, parent: THREE.Group): Spot {
  const [x, z] = APPLE_AT[i], g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData = { type: 'apple', i };
  part(Cyl(0.13, 0.18, 1.1, 10), '#8a5a30', g, 0, 0.55, 0);
  part(Sph(0.85), i % 2 ? '#4fae3d' : '#5bb845', g, 0, 1.55, 0, { s: [1, 0.85, 1] });
  part(Sph(0.5), '#62c24a', g, 0.45, 1.85, 0.25, { ol: 0.015 });
  const fruit = new THREE.Group(); g.add(fruit);
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + i, y = 1.25 + (k % 3) * 0.3;
    part(Sph(0.11), '#e2302a', fruit, Math.cos(a) * 0.78, y, Math.sin(a) * 0.78, { ol: 0.01, shadow: false });
  }
  parent.add(g); ctx.pickables.push(g);
  return { g, fruit, shake: 0, was: null };
}

function crystalRock(i: number, parent: THREE.Group): Spot {
  const [x, z] = CRYSTAL_AT[i], g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData = { type: 'crystal', i };
  const fruit = new THREE.Group(); g.add(fruit);
  part(Sph(0.6), '#7d7a86', fruit, 0, 0.32, 0, { s: [1.25, 0.75, 1] });
  const glow = (c: string) => T(c, { emissive: c, emissiveIntensity: 0.45 });
  for (const [dx, dz, h, r, c] of [[0, 0, 1.1, 0.0, '#9b7bff'], [0.32, 0.15, 0.75, 0.35, '#6fd8ff'], [-0.3, 0.2, 0.7, -0.4, '#c78bff'], [0.05, -0.3, 0.6, 0.2, '#6fd8ff']] as [number, number, number, number, string][]) {
    part(Cone(0.17, h, 6), glow(c), fruit, dx, 0.5 + h / 2, dz, { r: [r * 0.5, 0, r], ol: 0.012 });
  }
  // rubble once mined
  for (const [a, b] of [[-0.3, 0.1], [0.25, -0.2], [0.1, 0.3]]) part(Sph(0.14), '#6e6b76', g, a, 0.08, b, { s: [1, 0.6, 1] });
  parent.add(g); ctx.pickables.push(g);
  return { g, fruit, shake: 0, was: null };
}

const tmp = new THREE.Vector3();
let bound = false;
export function buildAcross() {
  const g = new THREE.Group();
  ctx.scene.add(g);
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(5.6, 40), T('#7cc24f'));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(ORCHARD_C[0], 0.01, ORCHARD_C[1]); lawn.scale.set(1, 0.5, 1); lawn.receiveShadow = true; g.add(lawn);
  const gravel = new THREE.Mesh(new THREE.CircleGeometry(5.0, 40), T('#a49e93'));
  gravel.rotation.x = -Math.PI / 2; gravel.position.set(CAVE_C[0], 0.01, CAVE_C[1]); gravel.scale.set(1, 0.5, 1); gravel.receiveShadow = true; g.add(gravel);
  // the cave: a rocky hill with a dark mouth, at the east end so it never hides the crystals
  const hx = CAVE_C[0] + 7.4, hz = CAVE_C[1] - 0.4;
  part(Sph(2.0), '#8b8794', g, hx, 0, hz, { s: [1.1, 0.85, 1] });
  part(Sph(1.1), '#9a96a3', g, hx + 1.2, 0, hz - 1.6, { s: [1.2, 0.8, 1] });
  part(Sph(0.75), '#211c2a', g, hx - 1.25, 0.25, hz + 1.25, { s: [1, 1.15, 0.35], r: [0, Math.PI / 4, 0], ol: false });
  trees = APPLE_AT.map((_, i) => appleTree(i, g));
  rocks = CRYSTAL_AT.map((_, i) => crystalRock(i, g));
  if (bound) return;
  bound = true;
  on('applesPicked', ({ i, n }) => {
    trees[i].shake = 0.35;
    const [sx, sy] = toScreen(tmp.set(APPLE_AT[i][0], 2.4, APPLE_AT[i][1])); fx(sx, sy, '+' + n + ' 🍎 apples', 'gold');
  });
  on('crystalHit', ({ i }) => { rocks[i].shake = 0.3; dust3(CRYSTAL_AT[i][0], CRYSTAL_AT[i][1]); });
  on('crystalBroken', ({ i, stone, crystal }) => {
    const [sx, sy] = toScreen(tmp.set(CRYSTAL_AT[i][0], 1.6, CRYSTAL_AT[i][1]));
    fx(sx, sy, '+' + stone + ' 🪨' + (crystal ? ' +1 💠' : ''), 'gold');
    for (let k = 0; k < 6; k++) sparkle(CRYSTAL_AT[i][0] + (Math.random() - 0.5) * 1.2, CRYSTAL_AT[i][1] + (Math.random() - 0.5) * 1.2);
  });
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function updateAcross(dt: number) {
  const t = now();
  trees.forEach((s, i) => {
    // A locked orchard still shows its trees full of apples.
    const ripe = S.level < ORCHARD_LVL || appleRipe(i, t);
    s.fruit.visible = ripe;
    if (s.shake > 0) { s.shake -= dt; s.g.rotation.z = Math.sin(s.shake * 60) * 0.05; } else s.g.rotation.z = 0;
    if (!ripe) {
      const left = (S.orchard[i] || 0) - t;
      if (left < 60_000) lbl('apple' + i, mmss(left), tmp.set(s.g.position.x, 2.7, s.g.position.z), 'timer');
      else s.fruit.visible = left < APPLE_REGROW_MS / 3;
    }
  });
  rocks.forEach((s, i) => {
    const up = S.level < CAVE_LVL || crystalUp(i, t);
    s.fruit.visible = up;
    if (s.shake > 0) { s.shake -= dt; s.fruit.rotation.z = Math.sin(s.shake * 60) * 0.06; } else s.fruit.rotation.z = 0;
    const d = caveHitsOn(i);
    s.fruit.scale.setScalar(1 - d * 0.05);
    if (d) lbl('crys' + i, '●'.repeat(d) + '○'.repeat(CAVE_HITS - d), tmp.set(s.g.position.x, 2.2, s.g.position.z), 'timer');
    else if (!up && (S.cave[i] || 0) - t < 60_000) lbl('crys' + i, mmss((S.cave[i] || 0) - t), tmp.set(s.g.position.x, 0.9, s.g.position.z), 'timer');
  });
  lbl('orchardsign', S.level < ORCHARD_LVL ? `<b>🍎 Apple Orchard</b><span>Found at level ${ORCHARD_LVL}</span>` : '<b>🍎 Apple Orchard</b><span>Tap a tree to pick</span>', tmp.set(ORCHARD_C[0], 2.8, ORCHARD_C[1] - 1.6), 'townsign');
  lbl('cavesign', S.level < CAVE_LVL ? `<b>💠 Crystal Cave</b><span>Found at level ${CAVE_LVL}</span>` : '<b>💠 Crystal Cave</b><span>Crystals, stone and 💎</span>', tmp.set(CAVE_C[0], 3.2, CAVE_C[1] - 1.6), 'townsign');
}
