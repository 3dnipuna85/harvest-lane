import * as THREE from 'three';
import { ctx } from '../context';
import { Cap, Cone, Cyl, RB, Sph, Tri, instanced, mat, part } from '../geometry';
import { ROADZ } from '../layout';
import { T } from '../materials';
import { smoke3 } from '../fx/particles';

/** Scenery from the concept art: farmhouse, windmill, pond with dock and ducks, pines, rocks, lanterns, flowers. */

export const POND = { x: -9.6, z: 7.9, r: 2.0 };
export const HOUSE = { x: 10.5, z: 1.4 };

let blades: THREE.Group;
let ducks: { g: THREE.Group; a: number; r: number; speed: number; bob: number }[] = [];
let chimneyT = 0;

function farmhouse(g: THREE.Object3D) {
  const h = new THREE.Group();
  h.position.set(HOUSE.x, 0, HOUSE.z);
  g.add(h);
  // stone walls and a red tiled roof with a cream gable
  part(RB(3.2, 1.7, 2.5, 0.14), '#f4e4c1', h, 0, 0.85, 0);
  part(RB(3.36, 0.22, 2.66, 0.08), '#d8c19a', h, 0, 0.11, 0, { ol: 0.02 });
  for (const s of [-1, 1]) part(RB(1.95, 0.2, 2.95, 0.08), '#d9483a', h, s * 0.78, 2.28, 0, { r: [0, 0, -s * 0.66] });
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    part(RB(1.95, 0.05, 0.08, 0.02), '#b8352a', h, s * (0.78 - 0.02), 2.4 - 0, -1.1 + k * 0.73, { r: [0, 0, -s * 0.66], ol: false, shadow: false });
  }
  part(Tri(2.85, 1.05, 2.48), '#f4e4c1', h, 0, 1.72, 0, { ol: false });
  part(RB(0.5, 1.2, 0.5, 0.08), '#c9744a', h, 0.85, 2.7, -0.55);
  part(RB(0.6, 0.14, 0.6, 0.05), '#a85a36', h, 0.85, 3.32, -0.55);
  // front: door, steps, windows with green shutters and flower boxes
  part(RB(0.62, 1.05, 0.1, 0.1), '#8a5530', h, -0.55, 0.6, 1.27);
  part(Sph(0.045), '#f0cd5f', h, -0.35, 0.6, 1.34, { ol: false });
  part(RB(1.0, 0.16, 0.5, 0.06), '#cfc2a8', h, -0.55, 0.08, 1.5);
  const win = (x: number, y: number, z: number, ry: number) => {
    const w = new THREE.Group();
    w.position.set(x, y, z); w.rotation.y = ry; h.add(w);
    part(RB(0.56, 0.6, 0.08, 0.05), '#fff7ea', w, 0, 0, 0);
    part(RB(0.44, 0.48, 0.06, 0.04), '#9fd8f0', w, 0, 0, 0.03, { ol: false });
    for (const s of [-1, 1]) part(RB(0.2, 0.62, 0.06, 0.04), '#4f9a4a', w, s * 0.4, 0, 0.02, { ol: 0.015 });
    part(RB(0.66, 0.16, 0.22, 0.05), '#9a6438', w, 0, -0.38, 0.1, { ol: 0.015 });
    for (const [fx, c] of [[-0.2, '#ff6b8a'], [0, '#ffd84a'], [0.2, '#ff8fbf']] as [number, string][]) part(Sph(0.09), c, w, fx, -0.27, 0.12, { ol: 0.012, shadow: false });
  };
  win(0.75, 0.95, 1.27, 0);
  win(1.62, 0.95, 0.5, Math.PI / 2);
  win(1.62, 0.95, -0.5, Math.PI / 2);
  // a lantern by the door and a mailbox at the path
  part(Cap(0.05, 0.25), '#5b3a26', h, -1.05, 1.35, 1.32, { ol: 0.012 });
  part(RB(0.18, 0.22, 0.18, 0.04), T('#ffe27a', { emissive: '#ffb300', emissiveIntensity: 0.7 }), h, -1.05, 1.15, 1.36, { ol: 0.015 });
  part(Cap(0.05, 0.7), '#7a4a2a', h, -1.9, 0.45, 2.2, { ol: 0.012 });
  part(RB(0.42, 0.26, 0.24, 0.1), '#e2463a', h, -1.9, 0.92, 2.2);
  part(RB(0.04, 0.16, 0.06, 0.02), '#f0cd5f', h, -1.67, 1.0, 2.2, { ol: false });
  // barrels and crates by the side wall
  for (const [x, z] of [[1.95, 1.0], [2.0, 0.45]]) {
    part(Cyl(0.26, 0.24, 0.55, 16), '#a8703c', h, x, 0.28, z);
    part(Cyl(0.27, 0.27, 0.05, 16), '#6b4429', h, x, 0.45, z, { ol: false });
  }
  part(RB(0.45, 0.45, 0.45, 0.06), '#c98f55', h, 2.0, 0.23, -0.4);
}

function windmill(g: THREE.Object3D, x: number, z: number) {
  const w = new THREE.Group();
  w.position.set(x, 0, z); g.add(w);
  part(Cyl(0.85, 1.05, 0.3, 8), '#b9b4a6', w, 0, 0.15, 0);
  part(Cyl(0.5, 0.82, 3.4, 8), '#c88a4c', w, 0, 1.95, 0);
  for (const y of [1.0, 2.0, 3.0]) part(Cyl(0.84 - (y - 0.3) * 0.1, 0.84 - (y - 0.3) * 0.1, 0.1, 8), '#9a6438', w, 0, y, 0, { ol: 0.015 });
  part(Cone(0.78, 0.9, 8), '#d9483a', w, 0, 4.1, 0);
  part(RB(0.3, 0.5, 0.08, 0.06), '#7a4a2a', w, 0, 0.6, 0.86);
  const hub = new THREE.Group();
  hub.position.set(0, 3.4, 0.55); hub.rotation.y = Math.PI / 4 - 0.4;
  w.add(hub);
  part(Cyl(0.16, 0.16, 0.3, 14), '#6b4429', hub, 0, 0, 0.1, { r: [Math.PI / 2, 0, 0] });
  blades = new THREE.Group();
  blades.position.z = 0.25; hub.add(blades);
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; blades.add(arm);
    part(RB(0.1, 2.0, 0.06, 0.03), '#8a5a36', arm, 0, 1.05, 0, { ol: 0.015 });
    part(RB(0.5, 1.5, 0.04, 0.03), '#f39a3c', arm, 0.3, 1.2, 0.01, { ol: 0.015 });
    for (let r = 0; r < 3; r++) part(RB(0.5, 0.04, 0.05, 0.01), '#8a5a36', arm, 0.3, 0.65 + r * 0.55, 0.03, { ol: false, shadow: false });
  }
}

function pine(g: THREE.Object3D, x: number, z: number, s: number) {
  const p = new THREE.Group();
  p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
  part(Cap(0.16, 0.5), '#8a5a36', p, 0, 0.35, 0);
  part(Cone(0.95, 1.2, 10), '#2f8a4a', p, 0, 1.2, 0);
  part(Cone(0.75, 1.05, 10), '#38a055', p, 0, 1.85, 0);
  part(Cone(0.5, 0.9, 10), '#46b562', p, 0, 2.45, 0);
}

function pond(g: THREE.Object3D) {
  const { x, z, r } = POND;
  part(Cyl(r + 0.15, r + 0.25, 0.12, 40), '#d6c9a4', g, x, 0.05, z);
  part(Cyl(r, r, 0.13, 40), T('#4cc6f2', {}), g, x, 0.07, z, { ol: false, shadow: false });
  part(Cyl(r * 0.7, r * 0.7, 0.135, 36), T('#6fd6f7', {}), g, x + 0.2, 0.072, z - 0.15, { ol: false, shadow: false });
  for (const [a, b] of [[-10.4, 7.3], [-9.0, 8.8], [-10.0, 8.9], [-8.6, 7.2]]) {
    part(Cyl(0.24, 0.24, 0.04, 14), '#61b84a', g, a, 0.15, b, { ol: 0.015, shadow: false });
  }
  part(Sph(0.08), '#ff9fc4', g, -9.0, 0.2, 8.8, { ol: 0.01, shadow: false });
  // stones around the rim
  const rocks: { m: THREE.Matrix4; c: string }[] = [];
  for (let k = 0; k < 16; k++) {
    const an = (k / 16) * Math.PI * 2;
    if (an > 0.45 && an < 1.15) continue; // gap for the dock
    rocks.push({ m: mat(x + Math.cos(an) * (r + 0.2), 0.1, z + Math.sin(an) * (r + 0.2), [1, 0.6, 1]), c: k % 2 ? '#b9b4a6' : '#d2cdc0' });
  }
  instanced(Sph(0.22), '#ffffff', rocks, g, 0.015);
  // wooden dock reaching into the water
  const d = new THREE.Group();
  d.position.set(x + 1.45, 0, z + 1.45); d.rotation.y = Math.PI / 4 + Math.PI;
  g.add(d);
  for (let k = 0; k < 6; k++) part(RB(0.95, 0.08, 0.3, 0.03), k % 2 ? '#c08a52' : '#b07a44', d, 0, 0.28, -0.4 + k * 0.33, { ol: 0.015 });
  for (const [px, pz] of [[-0.45, -0.4], [0.45, -0.4], [-0.45, 1.25], [0.45, 1.25]]) part(Cap(0.06, 0.3), '#7a4a2a', d, px, 0.2, pz, { ol: 0.012 });
  // ducks and ducklings paddle in slow circles
  ducks = [];
  for (const [rr, sc, col, sp] of [[1.2, 1, '#ffffff', 0.25], [1.25, 0.6, '#ffd84a', 0.25], [0.7, 0.95, '#ffffff', -0.3], [0.8, 0.55, '#ffd84a', -0.3]] as [number, number, string, number][]) {
    const dg = new THREE.Group(); dg.scale.setScalar(sc); g.add(dg);
    part(Sph(0.2), col, dg, 0, 0.18, 0, { s: [1, 0.75, 1.3], ol: 0.018 });
    part(Sph(0.13), col, dg, 0, 0.38, 0.2, { ol: 0.016 });
    part(Cone(0.05, 0.12, 8), '#ff9a2e', dg, 0, 0.36, 0.36, { r: [Math.PI / 2, 0, 0], ol: 0.01 });
    for (const s of [-1, 1]) part(Sph(0.022), '#2b1a10', dg, 0.07 * s, 0.42, 0.29, { ol: false, shadow: false });
    ducks.push({ g: dg, a: Math.random() * 6, r: rr, speed: sp, bob: Math.random() * 6 });
  }
}

function lantern(g: THREE.Object3D, x: number, z: number) {
  part(RB(0.22, 0.12, 0.22, 0.04), '#6b6b6b', g, x, 0.06, z, { ol: 0.012 });
  part(Cap(0.05, 1.2), '#4a3424', g, x, 0.75, z, { ol: 0.012 });
  part(RB(0.26, 0.32, 0.26, 0.05), T('#ffe27a', { emissive: '#ffb300', emissiveIntensity: 0.75 }), g, x, 1.5, z, { ol: 0.016 });
  part(Cone(0.22, 0.18, 4), '#3a2a1c', g, x, 1.75, z, { r: [0, Math.PI / 4, 0], ol: 0.012 });
}

function well(g: THREE.Object3D, x: number, z: number) {
  const w = new THREE.Group(); w.position.set(x, 0, z); g.add(w);
  part(Cyl(0.6, 0.65, 0.6, 18), '#b4afa3', w, 0, 0.3, 0);
  part(Cyl(0.47, 0.47, 0.62, 18), '#4a90b8', w, 0, 0.32, 0, { ol: false, shadow: false });
  for (const s of [-1, 1]) part(RB(0.1, 1.1, 0.1, 0.03), '#8a5a36', w, s * 0.55, 0.95, 0, { ol: 0.012 });
  for (const s of [-1, 1]) part(RB(0.75, 0.08, 1.2, 0.03), '#c2412f', w, s * 0.3, 1.62, 0, { r: [0, 0, -s * 0.6] });
  part(Cyl(0.06, 0.06, 1.0, 10), '#6b4429', w, 0, 1.25, 0, { r: [0, 0, Math.PI / 2], ol: 0.01 });
  part(Cyl(0.13, 0.11, 0.18, 12), '#9a6438', w, 0.1, 0.95, 0, { ol: 0.012 });
}

function sunflowers(g: THREE.Object3D, spots: [number, number][]) {
  for (const [x, z] of spots) {
    const s = new THREE.Group();
    s.position.set(x, 0, z); s.rotation.y = Math.PI / 4 + (Math.random() - 0.5) * 0.4; g.add(s);
    const h = 0.9 + Math.random() * 0.35;
    part(Cap(0.04, h), '#4f9a3a', s, 0, h / 2, 0, { ol: 0.012, shadow: false });
    part(Sph(0.1), '#5fae3d', s, 0.1, h * 0.45, 0, { s: [1.6, 0.4, 0.8], ol: 0.01, shadow: false });
    part(Cyl(0.24, 0.24, 0.05, 14), '#ffc72c', s, 0, h + 0.05, 0.03, { r: [Math.PI / 2 - 0.3, 0, 0], ol: 0.014 });
    part(Cyl(0.12, 0.12, 0.07, 12), '#7a4a2a', s, 0, h + 0.06, 0.06, { r: [Math.PI / 2 - 0.3, 0, 0], ol: false });
  }
}

/** Flower beds: green bush blobs dotted with flowers, all instanced. */
function flowerBeds(g: THREE.Object3D, spots: [number, number][]) {
  const FC = ['#ff6b8a', '#ffffff', '#ffd84a', '#b98cff', '#ff8a3d', '#ff4b5c'];
  const leaves: { m: THREE.Matrix4; c: string }[] = [], blooms: { m: THREE.Matrix4; c: string }[] = [];
  for (const [x, z] of spots) {
    for (let k = 0; k < 3; k++) {
      const lx = x + (Math.random() - 0.5) * 0.6, lz = z + (Math.random() - 0.5) * 0.6;
      leaves.push({ m: mat(lx, 0.16, lz, [1, 0.7, 1]), c: ['#4fae3d', '#5fbf47', '#58b843'][k] });
    }
    const c = FC[Math.floor(Math.random() * FC.length)];
    for (let k = 0; k < 6; k++) {
      blooms.push({ m: mat(x + (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 0.08, z + (Math.random() - 0.5) * 0.7), c });
    }
  }
  instanced(Sph(0.24), '#ffffff', leaves, g, 0.015);
  instanced(Sph(0.065), '#ffffff', blooms, g, false, false);
}

function rocks(g: THREE.Object3D, spots: [number, number, number][]) {
  instanced(Sph(0.4), '#ffffff', spots.map(([x, z, s], i) => ({ m: mat(x, 0.12 * s, z, [s * 1.1, s * 0.62, s * 0.9], [0, i, 0]), c: i % 2 ? '#a9a59a' : '#c4bfb2' })), g, 0.02);
}

export function buildDecor() {
  const g = new THREE.Group();
  ctx.scene.add(g);
  farmhouse(g);
  windmill(g, -11.4, -6.4);
  pond(g);
  // pines along the back and edges, as in the concept's forest border
  for (const [x, z, s] of [[-12.3, -8.6, 1.1], [-9.6, -8.9, 0.9], [-0.2, -9.0, 0.85], [5.9, -9.0, 0.9], [12.2, -7.9, 1.1], [-12.4, 2.0, 1.0],
    [12.4, 9.6, 1.0], [-14.6, -6.2, 1.4], [-27, 6.5, 1.5], [27, 5.5, 1.5], [14.8, -9, 1.4], [-14.8, -10.5, 1.4], [0, -11, 1.3], [7, -11.2, 1.4]]) {
    pine(g, x, z, s);
  }
  rocks(g, [[-12.4, -5.0, 0.8], [-12.0, -4.6, 0.5], [12.4, -5.2, 0.7], [-12.4, 9.8, 0.8], [-11.8, 10.1, 0.5], [12.5, 7.4, 0.6], [-6.8, -8.8, 0.6], [9.6, -8.9, 0.7]]);
  for (const x of [-10.4, -6.0, -2.7, 3.3, 6.3, 11.6]) lantern(g, x, ROADZ - 1.25);
  well(g, -11.6, -1.6);
  sunflowers(g, [[12.3, 3.4], [12.4, 4.0], [11.8, 3.8], [12.3, 4.6], [11.6, -5.4], [12.1, -5.8], [11.4, -6.2], [12.4, -6.5]]);
  flowerBeds(g, [[-12.3, 6.0], [-12.2, 4.6], [-6.4, 9.9], [-4.4, 10.0], [-3.1, 10.0], [0.7, 9.9], [3.0, 10.0], [5.4, 9.9], [8.2, 9.9],
    [8.3, 3.4], [8.4, 0.6], [-6.6, -4.9], [3.2, -5.0], [-12.3, -3.0], [12.3, -2.4], [9.8, 6.3]]);
}

export function updateDecor(dt: number, t: number) {
  if (blades) blades.rotation.z -= dt * 0.9;
  for (const d of ducks) {
    d.a += dt * d.speed;
    d.g.position.set(POND.x + Math.cos(d.a) * d.r, 0.04 + Math.sin(t * 2 + d.bob) * 0.025, POND.z + Math.sin(d.a) * d.r * 0.8);
    d.g.rotation.y = Math.atan2(-Math.sin(d.a) * Math.sign(d.speed), Math.cos(d.a) * 0.8 * Math.sign(d.speed));
  }
  chimneyT -= dt;
  if (chimneyT <= 0) { smoke3(HOUSE.x + 0.85, 3.45, HOUSE.z - 0.55); chimneyT = 0.9; }
}
