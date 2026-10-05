import * as THREE from 'three';
import { ctx } from '../context';
import { Cap, Cone, Cyl, Sph, part } from './smooth';
import { PEN, ROADZ } from '../layout';
import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../../data/animals';
import { animalProgress, animalState, animalUnlocked } from '../../game/animals';
import { inv } from '../../game/economy';
import { S } from '../../game/state';
import { iconHTML } from '../../ui/art';
import { lbl } from '../fx/labels';

interface Wanderer<V> { x: number; z: number; tx: number; tz: number; face: number; t: number; phase: number; v: V; kind: AnimalId; i: number }
interface ChickenView { g: THREE.Group; head: THREE.Group; legs: THREE.Group[] }
interface CowView { g: THREE.Group; head: THREE.Group; legs: THREE.Group[]; tail: THREE.Mesh }

let chickens: Wanderer<ChickenView>[] = [];
/** Cows, pigs and sheep: four-legged animals that share the same walk. */
let cows: Wanderer<CowView>[] = [];
const tmp = new THREE.Vector3();

/** Make an animal tappable: the pointer code finds userData.type on the group. */
function tag<V extends { g: THREE.Group }>(w: Wanderer<V>) {
  w.v.g.userData = { type: 'animal', kind: w.kind, i: w.i };
  ctx.pickables.push(w.v.g);
  return w;
}

function buildChicken(): ChickenView {
  const g = new THREE.Group();
  part(Sph(0.24), '#fffdf7', g, 0, 0.32, 0, { s: [1, 0.95, 1.1], ol: 0.022 });
  part(Sph(0.12), '#fffdf7', g, 0, 0.42, -0.24, { s: [0.8, 1.2, 0.7], r: [-0.5, 0, 0], ol: 0.018 });
  for (const s of [-1, 1]) part(Sph(0.11), '#f3ecdc', g, 0.2 * s, 0.33, -0.02, { s: [0.45, 0.8, 1.2], ol: 0.015 });
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.16); g.add(head);
  part(Sph(0.14), '#fffdf7', head, 0, 0.04, 0.03, { ol: 0.02 });
  part(Sph(0.06), '#ff4b3a', head, 0, 0.18, 0.02, { s: [0.6, 1, 1.5], ol: 0.012 });
  part(Cone(0.05, 0.1, 10), '#ffb02e', head, 0, 0.03, 0.18, { r: [Math.PI / 2, 0, 0], ol: 0.012 });
  part(Sph(0.035), '#ff4b3a', head, 0, -0.05, 0.13, { ol: false });
  for (const s of [-1, 1]) part(Sph(0.025), '#2b1a10', head, 0.08 * s, 0.07, 0.12, { ol: false, shadow: false });
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.position.set(0.08 * s, 0.14, 0); g.add(p);
    part(Cap(0.025, 0.1), '#ffa726', p, 0, -0.07, 0, { ol: 0.01 });
    legs.push(p);
  }
  g.scale.setScalar(1.1);
  ctx.scene.add(g);
  return { g, head, legs };
}

/** Chickens wander along the road and the grass east of the field, pecking when they stop. */
function updateChicken(h: Wanderer<ChickenView>, dt: number) {
  h.t -= dt;
  const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {
    const s = 1.2 * dt;
    h.x += (dx / d) * Math.min(s, d); h.z += (dz / d) * Math.min(s, d);
    h.face = Math.atan2(dx, dz); h.phase += dt * 18; h.v.head.rotation.x = 0;
  } else h.v.head.rotation.x = Math.sin(h.t * 9) > 0.3 ? 0.8 : 0;
  if (h.t <= 0) {
    h.t = 1.5 + Math.random() * 3;
    if (Math.random() < 0.6) { h.tx = -11 + Math.random() * 19; h.tz = ROADZ - 0.6 + Math.random() * 1.2; }
    else { h.tx = 8.6 + Math.random() * 2.2; h.tz = 4 + Math.random() * 4.5; }
  }
  h.v.g.position.set(h.x, d > 0.05 ? Math.abs(Math.sin(h.phase)) * 0.05 : 0, h.z);
  h.v.g.rotation.y = h.face;
  const sw = d > 0.05 ? Math.sin(h.phase) * 0.7 : 0;
  h.v.legs[0].rotation.x = sw; h.v.legs[1].rotation.x = -sw;
}

function buildCow(): CowView {
  const g = new THREE.Group();
  const body = part(Cap(0.36, 0.55), '#ffffff', g, 0, 0.66, 0, { r: [Math.PI / 2, 0, 0], ol: 0.028 });
  for (const [x, y, z, s] of [[0.3, 0.15, 0.1, 0.17], [-0.28, 0.05, -0.2, 0.2], [0.12, -0.15, 0.3, 0.14], [-0.2, 0.25, 0.25, 0.13]]) {
    part(Sph(s), '#3a2a22', body, x, y, z, { s: [0.5, 1, 1], ol: false, shadow: false });
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.2, 0.32], [0.2, 0.32], [-0.2, -0.32], [0.2, -0.32]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.42, z); g.add(p);
    part(Cap(0.09, 0.18), '#ffffff', p, 0, -0.2, 0, { ol: 0.02 });
    part(Sph(0.095), '#5a4136', p, 0, -0.34, 0, { s: [1, 0.6, 1], ol: 0.015 });
    legs.push(p);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.95, 0.62); g.add(head);
  part(Sph(0.3), '#ffffff', head, 0, 0, 0, { s: [1, 0.95, 0.95], ol: 0.026 });
  part(Sph(0.22), '#ffb3c1', head, 0, -0.12, 0.2, { s: [1.15, 0.75, 0.8], ol: 0.02 });
  for (const s of [-1, 1]) {
    part(Sph(0.04), '#7a3b4a', head, 0.08 * s, -0.1, 0.37, { ol: false, shadow: false });
    part(Sph(0.05), '#2b1a10', head, 0.13 * s, 0.08, 0.25, { ol: false, shadow: false });
    part(Sph(0.016), '#ffffff', head, 0.13 * s + 0.015, 0.1, 0.29, { ol: false, shadow: false });
    part(Sph(0.1), '#ffffff', head, 0.3 * s, 0.12, -0.02, { s: [1.3, 0.5, 0.7], r: [0, 0, s * 0.4], ol: 0.015 });
    part(Cone(0.045, 0.15, 10), '#f6e7c8', head, 0.14 * s, 0.3, -0.02, { r: [0, 0, -s * 0.4], ol: 0.012 });
  }
  part(Sph(0.12), '#3a2a22', head, -0.08, 0.18, 0.05, { s: [1.2, 0.6, 1], ol: false });
  const tail = part(Cap(0.025, 0.3), '#ffffff', g, 0, 0.75, -0.66, { r: [0.5, 0, 0], ol: 0.012 });
  part(Sph(0.06), '#3a2a22', tail, 0, -0.2, 0, { ol: false });
  g.scale.setScalar(1.05);
  ctx.scene.add(g);
  return { g, head, legs, tail };
}

/** A round pink pig for the pen, rigged like the cows so it shares their wandering. */
function buildPig(): CowView {
  const g = new THREE.Group(), pink = '#ffb3bf', dark = '#e98a9a';
  part(Sph(0.36), pink, g, 0, 0.45, 0, { s: [0.95, 0.85, 1.25], ol: 0.024 });
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.17, 0.24], [0.17, 0.24], [-0.17, -0.24], [0.17, -0.24]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.24, z); g.add(p);
    part(Cap(0.075, 0.1), pink, p, 0, -0.1, 0, { ol: 0.016 });
    part(Sph(0.075), '#c96d7e', p, 0, -0.2, 0, { s: [1, 0.5, 1], ol: 0.012 });
    legs.push(p);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.58, 0.4); g.add(head);
  part(Sph(0.25), pink, head, 0, 0, 0, { ol: 0.022 });
  part(Cyl(0.11, 0.12, 0.09, 32), dark, head, 0, -0.04, 0.22, { r: [Math.PI / 2, 0, 0], ol: 0.014 });
  for (const s of [-1, 1]) {
    part(Sph(0.022), '#7a3b4a', head, 0.04 * s, -0.04, 0.27, { ol: false, shadow: false });
    part(Sph(0.04), '#2b1a10', head, 0.1 * s, 0.07, 0.2, { ol: false, shadow: false });
    part(Sph(0.013), '#ffffff', head, 0.1 * s + 0.012, 0.09, 0.235, { ol: false, shadow: false });
    part(Cone(0.08, 0.14, 24), dark, head, 0.15 * s, 0.22, -0.02, { r: [0.3, 0, -s * 0.5], ol: 0.012 });
  }
  const tail = part(Cap(0.02, 0.12), dark, g, 0, 0.55, -0.45, { r: [-0.8, 0, 0], ol: 0.01 });
  g.scale.setScalar(1.05);
  ctx.scene.add(g);
  return { g, head, legs, tail };
}

/** A fluffy sheep: a cloud of wool puffs with a dark face and legs. */
function buildSheep(): CowView {
  const g = new THREE.Group(), wool = '#fbf8f1', dark = '#3b3330';
  const body = new THREE.Group(); body.position.y = 0.55; g.add(body);
  for (const [x, y, z, r] of [[0, 0, 0, 0.36], [0.2, 0.1, 0.2, 0.22], [-0.2, 0.1, 0.2, 0.22], [0.2, 0.1, -0.22, 0.22], [-0.2, 0.1, -0.22, 0.22], [0, 0.22, 0, 0.24], [0, 0.05, 0.32, 0.2], [0, 0.05, -0.34, 0.2]]) {
    part(Sph(r), wool, body, x, y, z, { ol: 0.016 });
  }
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.15, 0.22], [0.15, 0.22], [-0.15, -0.22], [0.15, -0.22]]) {
    const p = new THREE.Group();
    p.position.set(x, 0.32, z); g.add(p);
    part(Cap(0.05, 0.18), dark, p, 0, -0.16, 0, { ol: 0.01 });
    legs.push(p);
  }
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.42); g.add(head);
  part(Sph(0.17), dark, head, 0, 0, 0.04, { s: [0.9, 1, 1.15], ol: 0.016 });
  part(Sph(0.15), wool, head, 0, 0.13, -0.02, { ol: 0.012 });
  for (const sd of [-1, 1]) {
    part(Sph(0.07), dark, head, 0.17 * sd, 0.02, -0.02, { s: [1.4, 0.6, 0.8], ol: false });
    part(Sph(0.032), '#ffffff', head, 0.08 * sd, 0.05, 0.17, { ol: false, shadow: false });
    part(Sph(0.018), '#111', head, 0.08 * sd, 0.05, 0.195, { ol: false, shadow: false });
  }
  const tail = part(Sph(0.09), wool, g, 0, 0.62, -0.5, { ol: 0.01 });
  g.scale.setScalar(1.05);
  ctx.scene.add(g);
  return { g, head, legs, tail };
}

/** Cows (and the pig) amble around the pen and graze when they stop. */
function updateCow(c: Wanderer<CowView>, dt: number, t: number) {
  c.t -= dt;
  const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
  if (d > 0.05) {
    const s = 0.6 * dt;
    c.x += (dx / d) * Math.min(s, d); c.z += (dz / d) * Math.min(s, d);
    c.face = Math.atan2(dx, dz); c.phase += dt * 7;
  }
  if (c.t <= 0) {
    c.t = 3 + Math.random() * 4;
    if (c.kind === 'sheep') { c.tx = 8.6 + Math.random() * 3; c.tz = 5.6 + Math.random() * 2.8; }
    else {
      c.tx = PEN.x0 + 0.8 + Math.random() * (PEN.x1 - PEN.x0 - 1.6);
      c.tz = PEN.z0 + 0.9 + Math.random() * (PEN.z1 - PEN.z0 - 1.8);
    }
  }
  c.v.g.position.set(c.x, 0, c.z);
  let dr = c.face - c.v.g.rotation.y;
  dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  c.v.g.rotation.y += dr * 0.08;
  const sw = d > 0.05 ? Math.sin(c.phase) * 0.45 : 0;
  c.v.legs.forEach((l, k) => (l.rotation.x = k === 0 || k === 3 ? sw : -sw));
  c.v.head.rotation.x = d > 0.05 ? 0 : 0.35 + Math.sin(t * 1.3) * 0.15;
  c.v.tail.rotation.z = Math.sin(t * 3) * 0.4;
}

const BUILD: Record<Exclude<AnimalId, 'hen'>, () => CowView> = { cow: buildCow, pig: buildPig, sheep: buildSheep };

function addHen(i: number) {
  const x = -5 + i * 3;
  chickens.push(tag({ x, z: ROADZ + ((i % 3) - 1) * 0.3, tx: x, tz: ROADZ, face: 0, t: Math.random() * 3, phase: 0, v: buildChicken(), kind: 'hen', i }));
}

function addBeast(kind: Exclude<AnimalId, 'hen'>, i: number) {
  const x = kind === 'sheep' ? 9.2 + i * 0.7 : PEN.x0 + 1 + ((i * 1.3 + (kind === 'pig' ? 1.9 : 0)) % 2.4);
  const z = kind === 'sheep' ? 6.2 + (i % 2) : PEN.z0 + 1.2 + ((i * 1.6 + (kind === 'pig' ? 1 : 0)) % 2.6);
  cows.push(tag({ x, z, tx: x, tz: z, face: i * 1.7, t: i, phase: 0, v: BUILD[kind](), kind, i }));
}

/** Add views for animals bought since the scene was built. */
function syncHerds() {
  for (const k of ANIMAL_IDS) {
    const have = k === 'hen' ? chickens.length : cows.filter(c => c.kind === k).length;
    for (let i = have; i < S.animals[k].n; i++) k === 'hen' ? addHen(i) : addBeast(k, i);
  }
}

export function initAnimals() {
  chickens = [];
  cows = [];
  syncHerds();
}

/** Bubble over an animal: what it needs, how long it has left, or the product waiting to be collected. */
function animalLabel(kind: AnimalId, i: number, g: THREE.Group, h: number) {
  const a = ANIMALS[kind], key = 'an-' + kind + i;
  tmp.set(g.position.x, h, g.position.z);
  if (!animalUnlocked(kind)) { if (i === 0) lbl(key, '🔒 Lv ' + a.lvl, tmp, 'lock'); return; }
  const st = animalState(kind, i);
  if (st === 'ready') lbl(key, iconHTML(a.product, 'ic-need'), tmp, 'aready');
  else if (st === 'busy') lbl(key, `<b><i style="width:${(animalProgress(kind, i) * 100).toFixed(0)}%"></i></b>`, tmp, 'abusy');
  else lbl(key, `${iconHTML(a.feed, 'ic-need')}<span>${a.feedQty}</span>`, tmp, 'afeed' + (inv(a.feed) >= a.feedQty ? '' : ' short'));
}

export function updateAnimals(dt: number, t: number) {
  syncHerds();
  chickens.forEach(h => { updateChicken(h, dt); animalLabel('hen', h.i, h.v.g, 1.05); });
  cows.forEach(c => { updateCow(c, dt, t); animalLabel(c.kind, c.i, c.v.g, c.kind === 'cow' ? 1.75 : 1.35); });
}

/** World position of an animal, for effects like a product flying to the barn. */
export function animalPos(kind: AnimalId, i: number) {
  const w = kind === 'hen' ? chickens[i] : cows.find(c => c.kind === kind && c.i === i);
  return w ? new THREE.Vector3(w.v.g.position.x, 0.9, w.v.g.position.z) : new THREE.Vector3();
}
