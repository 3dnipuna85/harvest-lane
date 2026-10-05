import * as THREE from 'three';
import { ctx } from '../context';
import { Sph, emojiSprite } from '../geometry';
import { puffMat } from '../materials';

interface Puff {
  m: THREE.Mesh | THREE.Sprite;
  vx: number; vy: number; vz: number;
  life: number; max: number; grow: number; op: number;
  g?: number; sprite?: boolean;
}
let puffs: Puff[] = [];

export function resetParticles() { puffs = []; }

/** Chimney smoke. */
export function smoke3(x: number, y: number, z: number) {
  const m = new THREE.Mesh(Sph(0.22), puffMat('#ffffff', 0.9));
  m.position.set(x, y, z); ctx.scene.add(m);
  puffs.push({ m, vx: 0.3 + Math.random() * 0.2, vy: 1 + Math.random() * 0.4, vz: -0.15, life: 1.8, max: 1.8, grow: 1.4, op: 0.9 });
}

/** A dust puff that falls back down. */
export function dust3(x: number, z: number) {
  const m = new THREE.Mesh(Sph(0.11), puffMat('#e3c18c', 0.85));
  m.position.set(x, 0.4, z); ctx.scene.add(m);
  puffs.push({ m, vx: (Math.random() - 0.5) * 1.5, vy: 1.4 + Math.random(), vz: (Math.random() - 0.5) * 1.5, life: 0.55, max: 0.55, grow: 0.7, op: 0.85, g: -4 });
}

export function sparkle(x: number, z: number) {
  const sp = emojiSprite('✨', 0.45);
  sp.position.set(x, 0.7, z); ctx.scene.add(sp);
  puffs.push({ m: sp, vx: 0, vy: 0.7, vz: 0, life: 0.9, max: 0.9, grow: 0.3, op: 1, sprite: true });
}

export function updatePuffs(dt: number) {
  for (const p of puffs) {
    p.life -= dt;
    if (p.g) p.vy += p.g * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    const k = 1 - p.life / p.max, sc = 1 + k * p.grow;
    if (p.sprite) p.m.scale.set(0.45 * sc, 0.45 * sc, 1); else p.m.scale.setScalar(sc);
    const mat = p.m.material as THREE.Material;
    mat.opacity = p.op * Math.min(1, (p.life / p.max) * 1.6);
    if (p.life <= 0) { ctx.scene.remove(p.m); mat.dispose(); }
  }
  puffs = puffs.filter(p => p.life > 0);
}

/** Water droplets thrown up from the river. */
export function splash3(x: number, z: number, n = 6) {
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(Sph(0.07 + Math.random() * 0.05), puffMat(k % 2 ? '#ffffff' : '#bfeaff', 0.95));
    m.position.set(x, 0.15, z); ctx.scene.add(m);
    const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.9;
    puffs.push({ m, vx: Math.cos(a) * s, vy: 2 + Math.random() * 1.5, vz: Math.sin(a) * s, life: 0.6, max: 0.6, grow: 0.2, op: 0.95, g: -9 });
  }
}
