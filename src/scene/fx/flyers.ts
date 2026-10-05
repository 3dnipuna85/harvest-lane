import * as THREE from 'three';
import { ctx } from '../context';
import { emojiSprite } from '../geometry';

interface Fly { sp: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t: number }
let flies: Fly[] = [];

export function resetFlyers() { flies = []; }

/** An item icon that flies in an arc, e.g. from a plot to the barn. */
export function spawnFly(icon: string, from: THREE.Vector3, to: THREE.Vector3, delay = 0) {
  if (!ctx.ok3d) return;
  const sp = emojiSprite(icon, 0.9);
  sp.visible = false; ctx.scene.add(sp);
  flies.push({ sp, from, to, t: -delay });
}

export function updateFlies(dt: number) {
  for (const f of flies) {
    f.t += dt / 0.85;
    if (f.t < 0) continue;
    const k = Math.min(1, f.t), e = k * k * (3 - 2 * k);
    f.sp.visible = true;
    f.sp.position.lerpVectors(f.from, f.to, e);
    f.sp.position.y += Math.sin(k * Math.PI) * 2.6;
    const s = 0.95 - 0.4 * k;
    f.sp.scale.set(s, s, 1);
    if (k >= 1) { ctx.scene.remove(f.sp); f.sp.material.dispose(); }
  }
  flies = flies.filter(f => f.t < 1);
}
