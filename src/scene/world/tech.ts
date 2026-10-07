import * as THREE from 'three';
import { on } from '../../game/events';
import { S } from '../../game/state';
import { ctx } from '../context';
import { dust3 } from '../fx/particles';
import { Cone, Cyl, RB, Sph, part } from '../geometry';
import { PITCH } from '../layout';
import { T } from '../materials';

/**
 * Farm machines (data/tech.ts) on the farm: the tractor and the combine park by the field and sweep across it when
 * used; sprinklers stand between the plots; crop drones circle over the field.
 */

const FIELD_TOP = -0.5 - PITCH / 2 - 0.25;
const TRACTOR_PARK = { x: 7.9, z: -2.3 }, COMBINE_PARK = { x: -9.2, z: -2.2 };

interface Vehicle { g: THREE.Group; wheels: THREE.Mesh[]; park: { x: number; z: number }; run: number; dir: 1 | -1 }

function wheel(g: THREE.Group, x: number, z: number, r: number, list: THREE.Mesh[]) {
  const w = part(Cyl(r, r, 0.22, 16), '#2b2b30', g, x, r, z, { r: [Math.PI / 2, 0, 0], ol: 0.012 });
  part(Cyl(r * 0.5, r * 0.5, 0.24, 12), '#f2c94c', w, 0, 0, 0, { ol: false });
  list.push(w);
}

function tractor(): Vehicle {
  const g = new THREE.Group(), wheels: THREE.Mesh[] = [];
  part(RB(1.0, 0.45, 0.62, 0.1), '#3f9a3a', g, 0.25, 0.7, 0);
  part(RB(0.6, 0.62, 0.66, 0.08), '#3f9a3a', g, -0.35, 1.0, 0);
  part(RB(0.56, 0.44, 0.6, 0.06), '#bfe6ff', g, -0.35, 1.5, 0, { ol: 0.012 });
  part(RB(0.72, 0.07, 0.76, 0.03), '#2f7a2c', g, -0.35, 1.76, 0);
  part(Cyl(0.05, 0.05, 0.5, 8), '#5b6066', g, 0.55, 1.15, 0.18, { ol: 0.01 });
  for (const z of [-0.42, 0.42]) { wheel(g, -0.4, z, 0.42, wheels); wheel(g, 0.55, z, 0.24, wheels); }
  // a plough behind
  part(RB(0.25, 0.25, 0.9, 0.05), '#c2412f', g, -1.05, 0.35, 0);
  for (const z of [-0.3, 0, 0.3]) part(Cone(0.08, 0.3, 6), '#9a9a9a', g, -1.15, 0.15, z, { r: [0, 0, Math.PI], ol: 0.01 });
  return { g, wheels, park: TRACTOR_PARK, run: 0, dir: -1 };
}

function combine(): Vehicle {
  const g = new THREE.Group(), wheels: THREE.Mesh[] = [];
  part(RB(1.5, 0.8, 0.95, 0.12), '#e2463a', g, -0.1, 0.95, 0);
  part(RB(0.6, 0.55, 0.7, 0.08), '#bfe6ff', g, 0.35, 1.6, 0, { ol: 0.012 });
  part(RB(0.75, 0.08, 0.85, 0.03), '#c2362b', g, 0.35, 1.9, 0);
  // the header (reel) at the front
  part(RB(0.4, 0.3, 1.6, 0.06), '#f2c94c', g, 0.95, 0.45, 0);
  part(Cyl(0.16, 0.16, 1.5, 12), '#c98a2e', g, 1.08, 0.66, 0, { r: [Math.PI / 2, 0, 0], ol: 0.01 });
  part(Cyl(0.07, 0.07, 1.0, 8), '#d8d4cc', g, -0.6, 1.6, 0.35, { r: [0, 0, -0.9], ol: 0.01 });
  for (const z of [-0.5, 0.5]) { wheel(g, 0.35, z, 0.42, wheels); wheel(g, -0.65, z, 0.28, wheels); }
  return { g, wheels, park: COMBINE_PARK, run: 0, dir: 1 };
}

function sprinkler(g: THREE.Group, x: number, z: number) {
  part(Cyl(0.04, 0.05, 0.7, 8), '#5b6066', g, x, 0.35, z, { ol: 0.01 });
  part(Cyl(0.1, 0.1, 0.08, 10), '#3a7dc4', g, x, 0.72, z, { ol: 0.01 });
  const spray = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.6, 18, 1, true), T('#bfe9ff', { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  spray.position.set(x, 0.55, z); spray.rotation.x = Math.PI;
  g.add(spray);
  return spray;
}

function drone(): THREE.Group {
  const g = new THREE.Group();
  part(RB(0.5, 0.16, 0.5, 0.06), '#f4f4f4', g, 0, 0, 0);
  part(Sph(0.12), '#3a7dc4', g, 0, -0.1, 0, { ol: 0.01 });
  for (const [x, z] of [[0.35, 0.35], [-0.35, 0.35], [0.35, -0.35], [-0.35, -0.35]]) {
    part(Cyl(0.03, 0.03, 0.5, 6), '#5b6066', g, x / 2, 0, z / 2, { r: [0, Math.atan2(z, x), Math.PI / 2], ol: false });
    const r = part(Cyl(0.2, 0.2, 0.02, 14), T('#d8d4cc', { transparent: true, opacity: 0.6 }), g, x, 0.1, z, { ol: false, shadow: false });
    r.userData.rotor = true;
  }
  return g;
}

let trac: Vehicle | null = null, comb: Vehicle | null = null, sprays: THREE.Mesh[] = [], sprinklers: THREE.Group | null = null, drones: THREE.Group[] = [];
let bound = false;

export function buildTech() {
  trac = tractor(); comb = combine();
  for (const v of [trac, comb]) { v.g.position.set(v.park.x, 0, v.park.z); v.g.rotation.y = v.dir === -1 ? Math.PI : 0; v.g.visible = false; ctx.scene.add(v.g); }
  sprinklers = new THREE.Group(); sprinklers.visible = false; ctx.scene.add(sprinklers);
  sprays = [];
  for (const x of [-1.5 * PITCH, 1.5 * PITCH]) for (const z of [-0.5 + PITCH / 2, -0.5 + 2.5 * PITCH]) sprays.push(sprinkler(sprinklers, x, z));
  drones = [0, 1, 2].map(() => { const d = drone(); d.visible = false; ctx.scene.add(d); return d; });
  if (bound) return;
  bound = true;
  on('machineRun', ({ k }) => { const v = k === 'tractor' ? trac : comb; if (v) v.run = 0.001; });
}

const RUN_S = 4;
function drive(v: Vehicle, dt: number) {
  if (!v.run) return;
  v.run += dt / RUN_S;
  if (v.run >= 1) { v.run = 0; v.g.position.set(v.park.x, 0, v.park.z); v.g.rotation.y = v.dir === -1 ? Math.PI : 0; return; }
  // out along the top of the field and back again
  const far = -v.park.x, u = v.run < 0.5 ? v.run * 2 : 2 - v.run * 2;
  const x = v.park.x + (far - v.park.x) * u, back = v.run >= 0.5;
  v.g.position.set(x, 0, FIELD_TOP);
  v.g.rotation.y = (far > v.park.x) !== back ? 0 : Math.PI;
  for (const w of v.wheels) w.rotation.y += dt * 8;
  if (Math.random() < 0.3) dust3(x, FIELD_TOP + 0.3);
}

export function updateTech(dt: number, t: number) {
  if (!trac || !comb || !sprinklers) return;
  const has = (k: string) => (S.tech as string[] | undefined)?.includes(k);
  trac.g.visible = !!has('tractor');
  comb.g.visible = !!has('harvester');
  drive(trac, dt); drive(comb, dt);
  sprinklers.visible = !!has('sprinkler');
  sprays.forEach((s, i) => { s.rotation.y = t * 2 + i; s.scale.setScalar(0.85 + Math.sin(t * 6 + i) * 0.1); });
  const n = has('fleet') ? 3 : has('drone') ? 1 : 0;
  drones.forEach((d, i) => {
    d.visible = i < n;
    if (!d.visible) return;
    const a = t * 0.5 + (i * Math.PI * 2) / 3, r = 3.2 + i * 0.6;
    d.position.set(Math.cos(a) * r, 3.4 + Math.sin(t * 2 + i) * 0.15, 4.0 + Math.sin(a) * r * 0.8);
    d.rotation.y = -a;
    d.children.forEach(c => { if (c.userData.rotor) c.rotation.y += dt * 40; });
  });
}
