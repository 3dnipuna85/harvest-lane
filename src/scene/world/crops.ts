import * as THREE from 'three';
import type { CropId } from '../../data/crops';
import { Cap, Sph, part } from '../geometry';

export type Stage = 'sprout' | 'grow' | 'ripe';

/** Four plants per plot. */
const CROP_SPOTS = [[-0.52, -0.5], [0.52, -0.5], [-0.52, 0.5], [0.52, 0.5]];

function cropModel(type: CropId, ripeNow: boolean, c: THREE.Object3D) {
  if (type === 'wheat') {
    const st = ripeNow ? '#e3b94a' : '#86c54d', hd = ripeNow ? '#f6d363' : '#a9d867';
    for (const [dx, dz, h, r] of [[-0.12, 0, 0.55, 0.1], [0.1, 0.08, 0.65, -0.1], [0.02, -0.12, 0.5, 0], [0.16, -0.08, 0.45, 0.18]]) {
      const s = part(Cap(0.03, h), st, c, dx, h / 2 + 0.03, dz, { ol: 0.015, shadow: false });
      s.rotation.z = r;
      part(Cap(0.075, 0.18), hd, s, 0, h / 2 + 0.08, 0, { ol: 0.018, shadow: false });
    }
  } else if (type === 'corn') {
    part(Cap(0.07, 0.85), '#5fae3d', c, 0, 0.5, 0, { ol: 0.02 });
    for (const [y, s] of [[0.35, 1], [0.62, -1]]) part(Sph(0.14), '#6fc24a', c, s * 0.17, y, 0, { s: [2.2, 0.35, 1], r: [0, 0, s * 0.4], ol: 0.015, shadow: false });
    part(Cap(0.1, 0.22), ripeNow ? '#ffd83d' : '#bde07f', c, 0.13, 0.72, 0.08, { r: [0, 0, -0.35], ol: 0.02 });
    if (ripeNow) part(Sph(0.07), '#b7d45a', c, 0.17, 0.95, 0.08, { ol: 0.015 });
  } else if (type === 'carrot') {
    for (const [dx, dz, rz] of [[-0.07, 0, 0.35], [0.07, 0.04, -0.3], [0, -0.07, 0.05]]) part(Sph(0.11), '#5cb840', c, dx, 0.38, dz, { s: [0.7, 1.6, 0.7], r: [0, 0, rz], ol: 0.015, shadow: false });
    part(Sph(ripeNow ? 0.17 : 0.12), ripeNow ? '#ff8a24' : '#f0ad62', c, 0, 0.12, 0, { s: [1, 0.75, 1], ol: 0.02 });
  } else if (type === 'tomato') {
    part(Sph(0.28), '#4fae3d', c, 0, 0.36, 0, { s: [1, 1.1, 1] });
    for (const [dx, dy, dz] of [[0.2, 0.3, 0.16], [-0.18, 0.45, 0.17], [0.06, 0.2, -0.22], [0.0, 0.58, 0.12]]) part(Sph(0.11), ripeNow ? '#ff4b3a' : '#9fd25a', c, dx, dy, dz, { ol: 0.018 });
  } else {
    part(Sph(0.27), '#4caa3b', c, 0, 0.17, 0, { s: [1, 0.55, 1] });
    for (const [dx, dz] of [[0.22, 0.12], [-0.2, 0.15], [0.05, -0.24]]) {
      const b = part(Sph(0.1), ripeNow ? '#ff3f5e' : '#d8eaa6', c, dx, 0.16, dz, { s: [1, 1.2, 1], ol: 0.018 });
      part(Sph(0.05), '#4caa3b', b, 0, 0.09, 0, { s: [1.4, 0.4, 1.4], ol: false, shadow: false });
    }
  }
}

export function buildCrop(type: CropId, stage: Stage) {
  const g = new THREE.Group();
  CROP_SPOTS.forEach(([x, z], k) => {
    const c = new THREE.Group();
    c.position.set(x, 0.36, z); c.rotation.y = k * 1.9; g.add(c);
    if (stage === 'sprout') {
      part(Sph(0.08), '#7dd35a', c, -0.06, 0.1, 0, { s: [1.3, 0.5, 0.8], r: [0, 0, 0.5], ol: 0.015, shadow: false });
      part(Sph(0.08), '#8ee06a', c, 0.06, 0.12, 0, { s: [1.3, 0.5, 0.8], r: [0, 0, -0.5], ol: 0.015, shadow: false });
      part(Cap(0.02, 0.1), '#6cc04a', c, 0, 0.05, 0, { ol: false, shadow: false });
    } else cropModel(type, stage === 'ripe', c);
  });
  return g;
}
