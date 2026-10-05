import * as THREE from 'three';
import { ctx } from '../context';
import { Cap, Cyl, RB, Sph, part } from '../geometry';
import { BX, BZ } from '../layout';
import { T } from '../materials';

const SKIN = T('#ffd2b0', { emissive: '#ff9c7a', emissiveIntensity: 0.18 });
const SHIRTS = ['#4aa3e8', '#9b6be8', '#3cc08f', '#ff9a3c', '#f06aa8', '#7bbf3a'];

interface Outfit { shirt: string; pants: string; hat: string; band: string; hair: string }
export interface PersonView {
  root: THREE.Group;
  legs: THREE.Group[];
  arms: THREE.Group[];
  upper: THREE.Group;
  head: THREE.Group;
  hoe: THREE.Group;
  basket: THREE.Group;
}

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
  v: PersonView;
}

/** Chibi farmer: big round head, overalls, straw hat tilted back. */
function buildPerson(o: Outfit): PersonView {
  const root = new THREE.Group(), legs: THREE.Group[] = [], arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(0.11 * s, 0.3, 0); root.add(piv);
    part(Cap(0.085, 0.12), o.pants, piv, 0, -0.14, 0, { ol: 0.02 });
    part(Sph(0.1), '#6b4429', piv, 0, -0.27, 0.04, { s: [1, 0.65, 1.35], ol: 0.02 });
    legs.push(piv);
  }
  const upper = new THREE.Group();
  upper.position.y = 0.3; root.add(upper);
  part(Cap(0.25, 0.1), o.shirt, upper, 0, 0.3, 0, { ol: 0.025 });
  part(RB(0.5, 0.24, 0.42, 0.12), o.pants, upper, 0, 0.18, 0, { ol: 0.025 });
  part(RB(0.26, 0.18, 0.06, 0.05), o.pants, upper, 0, 0.34, 0.2, { ol: 0.015 });
  for (const s of [-1, 1]) part(Cap(0.025, 0.14), o.pants, upper, 0.1 * s, 0.45, 0.18, { ol: false, r: [0, 0, s * 0.2] });
  for (const s of [-1, 1]) part(Sph(0.035), '#ffd447', upper, 0.1 * s, 0.38, 0.23, { ol: false, shadow: false });
  const head = new THREE.Group();
  head.position.y = 0.82; upper.add(head);
  part(Sph(0.34), SKIN, head, 0, 0, 0, { ol: 0.028 });
  part(Sph(0.35), o.hair, head, 0, 0.06, -0.12, { s: [1.02, 0.92, 0.8], ol: false });
  for (const s of [-1, 1]) {
    part(Sph(0.055), '#2b1a10', head, 0.12 * s, 0.02, 0.3, { s: [0.85, 1.15, 0.6], ol: false, shadow: false });
    part(Sph(0.018), '#ffffff', head, 0.12 * s + 0.018, 0.05, 0.33, { ol: false, shadow: false });
    part(Sph(0.06), '#ff9a9a', head, 0.2 * s, -0.08, 0.26, { s: [1, 0.6, 0.4], ol: false, shadow: false });
  }
  part(Sph(0.045), '#f2b394', head, 0, -0.05, 0.335, { ol: false, shadow: false });
  const mouth = part(Cap(0.017, 0.07), '#a8443a', head, 0, -0.14, 0.31, { ol: false, shadow: false });
  mouth.rotation.z = Math.PI / 2;
  const hat = new THREE.Group();
  hat.position.set(0, 0.2, -0.06); hat.rotation.x = -0.32; head.add(hat);
  part(Cyl(0.46, 0.46, 0.05, 28), o.hat, hat, 0, 0.02, 0, { ol: 0.022 });
  part(Sph(0.27), o.hat, hat, 0, 0.1, 0, { s: [1, 0.7, 1], ol: 0.022 });
  part(Cyl(0.265, 0.265, 0.07, 24), o.band, hat, 0, 0.07, 0, { ol: false });
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(0.3 * s, 0.43, 0); upper.add(piv);
    part(Cap(0.075, 0.18), o.shirt, piv, 0, -0.13, 0, { ol: 0.02 });
    part(Sph(0.08), SKIN, piv, 0, -0.29, 0, { ol: 0.02 });
    arms.push(piv);
  }
  const hoe = new THREE.Group(); arms[0].add(hoe);
  part(Cap(0.028, 0.95), '#b07a42', hoe, 0, -0.6, 0, { ol: 0.015 });
  part(RB(0.26, 0.05, 0.24, 0.03), '#a9b4bd', hoe, 0, -1.08, -0.1, { ol: 0.015 });
  hoe.visible = false;
  const basket = new THREE.Group(); arms[1].add(basket);
  part(Cyl(0.17, 0.13, 0.2, 16), '#d9a65c', basket, 0, -0.42, 0.06, { ol: 0.02 });
  basket.visible = false;
  root.scale.setScalar(1.25);
  ctx.scene.add(root);
  return { root, legs, arms, upper, head, hoe, basket };
}

export function mkChar(kind: CharKind, i: number): Char {
  const o: Outfit = kind === 'player' ? { shirt: '#ff5a4e', pants: '#3d7bd9', hat: '#f6cf5a', band: '#e2463a', hair: '#6b3d22' }
    : kind === 'seller' ? { shirt: SHIRTS[(i + 3) % 6], pants: '#6d5844', hat: '#fff4e0', band: '#4aa3e8', hair: '#2e2018' }
    : { shirt: SHIRTS[i % 6], pants: '#8a5a36', hat: '#e7bd6c', band: '#8a5a36', hair: ['#3b2416', '#c27a3a', '#1f1a17', '#e0b060'][i % 4] };
  return {
    id: kind + i, kind, x: BX[0] + 0.6 + i * 0.3, z: BZ + 2.0, tx: 0, tz: 0, face: 0, phase: Math.random() * 6, state: 'idle',
    act: 0, actDur: 0.5, actType: null, task: null, done: false, idleT: Math.random(), wave: 0,
    speed: kind === 'player' ? 5.0 : 2.7, v: buildPerson(o),
  };
}

export function removeChar(c: Char) { ctx.scene.remove(c.v.root); }

/** Pose the rig for this frame: hop and swing when walking, hoe swing or basket scoop when working, wave when selling. */
export function poseChar(c: Char, t: number) {
  const v = c.v, walking = c.state === 'walk', working = c.state === 'work';
  const hop = walking ? Math.abs(Math.sin(c.phase)) : 0;
  v.root.position.set(c.x, hop * 0.09, c.z);
  let dr = c.face - v.root.rotation.y;
  dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  v.root.rotation.y += dr * 0.25;
  const sw = walking ? Math.sin(c.phase) * 0.8 : 0;
  v.legs[0].rotation.x = sw; v.legs[1].rotation.x = -sw;
  v.arms[0].rotation.set(walking ? -sw * 0.9 : Math.sin(t * 2 + c.phase) * 0.05, 0, 0.12);
  v.arms[1].rotation.set(walking ? sw * 0.9 : -Math.sin(t * 2 + c.phase) * 0.05, 0, -0.12);
  v.upper.rotation.set(0, 0, walking ? Math.sin(c.phase) * 0.06 : 0);
  const breathe = walking ? 0 : Math.sin(t * 2.4 + c.phase) * 0.02;
  v.upper.position.y = 0.3;
  v.upper.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
  v.head.rotation.set(0, walking ? 0 : Math.sin(t * 0.7 + c.phase) * 0.25, 0);
  v.hoe.visible = false; v.basket.visible = false;
  if (working) {
    const p = c.act / c.actDur;
    if (c.actType === 'plant') {
      v.hoe.visible = true;
      const k = (p * 2) % 1;
      v.arms[0].rotation.x = k < 0.55 ? -0.6 + -2.2 * (k / 0.55) : -2.8 + 2.1 * ((k - 0.55) / 0.45);
      v.arms[1].rotation.x = v.arms[0].rotation.x * 0.7;
      v.upper.rotation.x = k > 0.55 ? 0.3 * ((k - 0.55) / 0.45) : -0.05;
      if (k > 0.55) { const sq = Math.sin(((k - 0.55) / 0.45) * Math.PI) * 0.06; v.upper.scale.set(1 + sq, 1 - sq, 1 + sq); }
    } else {
      const s = Math.sin(p * Math.PI);
      v.basket.visible = true;
      v.upper.rotation.x = 0.55 * s; v.upper.position.y = 0.3 - 0.1 * s;
      v.legs[0].rotation.x = v.legs[1].rotation.x = -0.35 * s;
      v.arms[0].rotation.x = -1.3 * s - 0.2; v.arms[1].rotation.x = -0.6 * s;
    }
  }
  if (c.wave > 0) { v.arms[0].rotation.set(-2.9, 0, 0.3 + Math.sin(t * 16) * 0.35); v.root.position.y = Math.abs(Math.sin(t * 12)) * 0.06; }
}
