import * as THREE from 'three';
import { part as basePart, RB, type PartOpts } from '../geometry';

/**
 * Smooth, high-detail building blocks for the farmer, helpers and animals. The world keeps its chunky
 * cel-shaded look; characters get dense geometry, soft shading and thin outlines so they read as
 * rounded toys like the concept art instead of faceted low-poly shapes.
 */
const GC: Record<string, THREE.BufferGeometry> = {};
const geo = <G extends THREE.BufferGeometry>(k: string, make: () => G): G => (GC[k] as G) || (GC[k] = make()) as G;

export const Sph = (r: number) => geo('sp' + r, () => new THREE.SphereGeometry(r, 48, 32));
export const Cap = (r: number, l: number) => geo('cp' + r + '|' + l, () => new THREE.CapsuleGeometry(r, l, 12, 32));
export const Cyl = (a: number, b: number, h: number, s = 48) => geo('cy' + [a, b, h, s], () => new THREE.CylinderGeometry(a, b, h, Math.max(s, 40)));
export const Cone = (r: number, h: number, s = 32) => geo('cn' + [r, h, s], () => new THREE.ConeGeometry(r, h, Math.max(s, 28)));
export { RB };

/** Soft shading ramp: smooth light falloff with lifted shadows, instead of the world's hard 4-step bands. */
const softGrad = (() => {
  const d = new Uint8Array([150, 190, 225, 250, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

const MC: Record<string, THREE.MeshToonMaterial> = {};
export function S(color: string, extra?: THREE.MeshToonMaterialParameters) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  return MC[k] || (MC[k] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: softGrad }, extra || {})));
}

/** Like geometry.part, with the soft material and a thinner ink outline. */
export function part(g: THREE.BufferGeometry, color: string | THREE.Material, parent: THREE.Object3D | null,
  x = 0, y = 0, z = 0, o: PartOpts = {}) {
  const ol = o.ol === false ? false : Math.min(o.ol || 0.028, 0.014);
  return basePart(g, typeof color === 'string' ? S(color) : color, parent, x, y, z, { ...o, ol });
}
