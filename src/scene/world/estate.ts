import * as THREE from 'three';
import { on } from '../../game/events';
import { S } from '../../game/state';
import { ctx } from '../context';
import { sparkle } from '../fx/particles';
import { Cap, Cone, Cyl, RB, Sph, part } from '../geometry';
import { T } from '../materials';
import { HOUSE } from './decor';

/** Farm tier dressing around the farmhouse: each upgrade (data/tiers.ts) adds its own set, kept from then on. */

const tiers: THREE.Group[] = [];
let water: THREE.Mesh | null = null, flags: THREE.Mesh[] = [];
const GOLD = () => T('#f5c542', { emissive: '#b8860b', emissiveIntensity: 0.35 });

/** Tier 1, Country Farm: a white picket yard fence with a rose arch over the front path. */
function countryFarm(g: THREE.Group) {
  const z = HOUSE.z + 2.55, door = HOUSE.x - 0.55;
  for (const [x0, x1] of [[HOUSE.x - 1.75, door - 0.45], [door + 0.45, HOUSE.x + 1.25]]) {
    const n = Math.round((x1 - x0) / 0.32);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      part(RB(0.1, 0.5, 0.06, 0.02), '#fffaf0', g, x, 0.25, z, { ol: 0.012 });
      part(Cone(0.06, 0.1, 4), '#fffaf0', g, x, 0.55, z, { ol: false });
    }
    part(RB(x1 - x0, 0.06, 0.04, 0.02), '#f3ead8', g, (x0 + x1) / 2, 0.36, z - 0.04, { ol: 0.01 });
  }
  // the rose arch
  for (const s of [-1, 1]) part(Cap(0.06, 1.1), '#fffaf0', g, door + s * 0.42, 0.62, z, { ol: 0.012 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 18, Math.PI), T('#fffaf0'));
  arch.position.set(door, 1.2, z); g.add(arch);
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    part(Sph(0.11), '#4fae3d', g, door + Math.cos(a) * 0.42, 1.2 + Math.sin(a) * 0.42, z + 0.02, { ol: false, shadow: false });
    if (k % 2) part(Sph(0.07), k % 4 === 1 ? '#ff5d7d' : '#ff9fbf', g, door + Math.cos(a) * 0.44, 1.22 + Math.sin(a) * 0.44, z + 0.09, { ol: 0.01, shadow: false });
  }
}

/** Tier 2, Ranch: lamp posts by the yard, stacked hay bales and a dovecote. */
function ranch(g: THREE.Group) {
  for (const x of [HOUSE.x - 2.05, HOUSE.x + 1.6]) {
    part(Cyl(0.05, 0.07, 1.6, 10), '#3c3c44', g, x, 0.8, HOUSE.z + 2.75, { ol: 0.012 });
    part(RB(0.24, 0.3, 0.24, 0.05), T('#ffe27a', { emissive: '#ffb300', emissiveIntensity: 0.8 }), g, x, 1.72, HOUSE.z + 2.75, { ol: 0.015 });
    part(Cone(0.2, 0.16, 4), '#3c3c44', g, x, 1.95, HOUSE.z + 2.75, { ol: 0.012, r: [0, Math.PI / 4, 0] });
  }
  for (const [x, y, z] of [[HOUSE.x - 2.2, 0.22, HOUSE.z - 2.4], [HOUSE.x - 1.5, 0.22, HOUSE.z - 2.6], [HOUSE.x - 1.85, 0.62, HOUSE.z - 2.5]]) {
    const b = part(Cyl(0.24, 0.24, 0.55, 14), '#e8c35a', g, x, y, z, { ol: 0.015, r: [0, 0, Math.PI / 2] });
    part(Cyl(0.245, 0.245, 0.04, 14), '#b8862e', b, 0, 0.12, 0, { ol: false });
    part(Cyl(0.245, 0.245, 0.04, 14), '#b8862e', b, 0, -0.12, 0, { ol: false });
  }
  const d = new THREE.Group(); d.position.set(HOUSE.x + 1.9, 0, HOUSE.z + 4.3); g.add(d);
  part(Cyl(0.06, 0.08, 1.7, 10), '#8a5530', d, 0, 0.85, 0, { ol: 0.012 });
  part(RB(0.7, 0.5, 0.7, 0.06), '#fffaf0', d, 0, 1.9, 0);
  for (const r of [0, Math.PI / 2]) part(RB(0.14, 0.16, 0.72, 0.03), '#3a2a22', d, 0, 1.9, 0, { ol: false, r: [0, r, 0] });
  part(Cone(0.6, 0.45, 4), '#3a7dc4', d, 0, 2.38, 0, { r: [0, Math.PI / 4, 0] });
  for (const a of [0.4, 2.2, 4.1]) part(Sph(0.09), '#f4f4f4', d, Math.cos(a) * 0.42, 2.25 + (a % 1) * 0.1, Math.sin(a) * 0.42, { ol: 0.01, shadow: false });
}

/** Tier 3, Estate: a round stone fountain and clipped hedge balls. */
function estate(g: THREE.Group) {
  const f = new THREE.Group(); f.position.set(8.2, 0, 8.1); g.add(f);
  part(Cyl(0.95, 1.0, 0.36, 28), '#d9d3c6', f, 0, 0.18, 0);
  water = part(Cyl(0.82, 0.82, 0.05, 28), T('#7fd0f0', { emissive: '#3aa0d0', emissiveIntensity: 0.25 }), f, 0, 0.34, 0, { ol: false });
  part(Cyl(0.12, 0.16, 0.8, 12), '#cfc8b8', f, 0, 0.6, 0);
  part(Cyl(0.42, 0.2, 0.14, 20), '#d9d3c6', f, 0, 1.02, 0);
  part(Sph(0.13), '#9fdcf5', f, 0, 1.18, 0, { ol: false });
  for (const [x, z] of [[7.0, 6.9], [9.4, 7.1], [7.0, 9.3]]) {
    part(Cyl(0.18, 0.22, 0.3, 10), '#b8703c', g, x, 0.15, z, { ol: 0.012 });
    part(Sph(0.38), '#3f9a3a', g, x, 0.62, z, { ol: 0.02 });
    part(Sph(0.24), '#4fae3d', g, x, 1.08, z, { ol: 0.015 });
  }
}

/** Tier 4, Grand Estate: a golden rooster weathervane on the roof and golden pennants by the yard. */
function grand(g: THREE.Group) {
  const v = new THREE.Group(); v.position.set(HOUSE.x, 2.45, HOUSE.z); g.add(v);
  part(Cyl(0.03, 0.03, 0.7, 8), GOLD(), v, 0, 0.35, 0, { ol: 0.01 });
  part(Sph(0.16), GOLD(), v, 0, 0.82, 0, { s: [1.3, 1, 0.6] });
  part(Sph(0.09), GOLD(), v, 0.17, 0.98, 0, { ol: 0.01 });
  part(Cone(0.12, 0.3, 6), GOLD(), v, -0.2, 0.98, 0, { r: [0, 0, 0.6], ol: 0.01 });
  part(Sph(0.04), '#e2463a', v, 0.2, 1.08, 0, { ol: false });
  flags = [];
  for (const x of [HOUSE.x - 2.4, HOUSE.x + 2.0]) {
    part(Cyl(0.04, 0.05, 2.4, 8), GOLD(), g, x, 1.2, HOUSE.z + 2.0, { ol: 0.012 });
    part(Sph(0.08), GOLD(), g, x, 2.44, HOUSE.z + 2.0, { ol: 0.01 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42, 6, 1), T('#e2463a', { side: THREE.DoubleSide }));
    fl.geometry.translate(0.35, 0, 0);
    fl.position.set(x + 0.04, 2.15, HOUSE.z + 2.0);
    g.add(fl); flags.push(fl);
    part(Sph(0.07), GOLD(), fl, 0.32, 0, 0.01, { ol: false });
  }
}

let bound = false;
export function buildEstate() {
  tiers.length = 0; water = null; flags = [];
  for (const make of [countryFarm, ranch, estate, grand]) {
    const g = new THREE.Group();
    g.visible = false;
    make(g);
    ctx.scene.add(g);
    tiers.push(g);
  }
  if (bound) return;
  bound = true;
  on('farmUpgrade', () => { for (let k = 0; k < 10; k++) setTimeout(() => sparkle(HOUSE.x - 2 + Math.random() * 4, HOUSE.z + 1 + Math.random() * 5), k * 90); });
}

export function updateEstate(t: number) {
  tiers.forEach((g, i) => { g.visible = S.tier > i; });
  if (water) water.position.y = 0.34 + Math.sin(t * 2) * 0.01;
  flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 2.2 + i) * 0.35; });
}
