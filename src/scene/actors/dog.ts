import * as THREE from 'three';
import { ctx } from '../context';
import { Cap, Cyl, Sph, part } from '../geometry';
import { getPlayer } from './ai';

/** The farmer's dog: trots after the player, sits and wags when they stop. */
interface DogView { g: THREE.Group; legs: THREE.Group[]; tail: THREE.Group; head: THREE.Group }
let dog: { x: number; z: number; face: number; phase: number; v: DogView } | null = null;

function buildDog(): DogView {
  const g = new THREE.Group();
  const fur = '#d9964a', dark = '#8a5126', cream = '#fff3dc';
  part(Cap(0.2, 0.36), fur, g, 0, 0.42, 0, { r: [Math.PI / 2, 0, 0], ol: 0.022 });
  part(Sph(0.15), cream, g, 0, 0.4, 0.2, { s: [1, 0.9, 1.1], ol: false, shadow: false });
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, -0.2], [0.12, -0.2]]) {
    const p = new THREE.Group(); p.position.set(x, 0.3, z); g.add(p);
    part(Cap(0.06, 0.14), fur, p, 0, -0.12, 0, { ol: 0.016 });
    part(Sph(0.07), cream, p, 0, -0.23, 0.02, { s: [1, 0.6, 1.2], ol: 0.012 });
    legs.push(p);
  }
  const head = new THREE.Group(); head.position.set(0, 0.68, 0.32); g.add(head);
  part(Sph(0.22), fur, head, 0, 0, 0, { ol: 0.022 });
  part(Sph(0.13), cream, head, 0, -0.06, 0.17, { s: [1.1, 0.8, 1], ol: 0.016 });
  part(Sph(0.05), '#2b1a10', head, 0, 0, 0.29, { ol: false });
  part(Cyl(0.04, 0.04, 0.02, 10), '#ff7a8a', head, 0, -0.14, 0.24, { r: [0.4, 0, 0], ol: false, shadow: false });
  for (const s of [-1, 1]) {
    part(Sph(0.038), '#2b1a10', head, 0.09 * s, 0.07, 0.19, { ol: false, shadow: false });
    part(Sph(0.012), '#ffffff', head, 0.09 * s + 0.012, 0.09, 0.22, { ol: false, shadow: false });
    part(Sph(0.1), dark, head, 0.2 * s, 0.0, -0.02, { s: [0.45, 1.3, 0.8], r: [0, 0, s * 0.25], ol: 0.014 });
  }
  part(Cyl(0.12, 0.12, 0.05, 14), '#e2463a', g, 0, 0.56, 0.26, { r: [0.5, 0, 0], ol: false });
  const tail = new THREE.Group(); tail.position.set(0, 0.5, -0.33); g.add(tail);
  part(Cap(0.04, 0.2), fur, tail, 0, 0.12, -0.04, { r: [-0.6, 0, 0], ol: 0.012 });
  g.scale.setScalar(1.1);
  ctx.scene.add(g);
  return { g, legs, tail, head };
}

export function initDog() {
  const p = getPlayer();
  dog = { x: p.x - 0.8, z: p.z + 0.5, face: Math.PI / 4, phase: 0, v: buildDog() };
}

export function updateDog(dt: number, t: number) {
  if (!dog) return;
  const p = getPlayer();
  // aim for a spot beside and a little behind the farmer
  const tx = p.x - 0.75 * Math.sin(p.face) - 0.45 * Math.cos(p.face), tz = p.z - 0.75 * Math.cos(p.face) + 0.45 * Math.sin(p.face);
  const dx = tx - dog.x, dz = tz - dog.z, d = Math.hypot(dx, dz);
  const moving = d > 0.25;
  if (moving) {
    const sp = Math.min(d, Math.max(2.5, d * 3) * dt);
    dog.x += (dx / d) * sp; dog.z += (dz / d) * sp;
    dog.face = Math.atan2(dx, dz); dog.phase += dt * 16;
  } else dog.face += (Math.PI / 4 - dog.face) * Math.min(1, dt * 3);
  const v = dog.v;
  v.g.position.set(dog.x, moving ? Math.abs(Math.sin(dog.phase)) * 0.06 : 0, dog.z);
  let dr = dog.face - v.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); v.g.rotation.y += dr * 0.2;
  const sw = moving ? Math.sin(dog.phase) * 0.7 : 0;
  v.legs.forEach((l, k) => (l.rotation.x = k === 0 || k === 3 ? sw : -sw));
  v.tail.rotation.z = Math.sin(t * (moving ? 10 : 14)) * 0.5;
  v.head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.3;
}
