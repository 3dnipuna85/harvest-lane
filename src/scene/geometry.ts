import * as THREE from 'three';
import { T, olMat } from './materials';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const GC: Record<string, THREE.BufferGeometry> = {};
const geo = <G extends THREE.BufferGeometry>(k: string, make: () => G): G => (GC[k] as G) || (GC[k] = make()) as G;

/** A box whose edges and corners are rounded with radius r. */
export function roundedBox(w: number, h: number, d: number, r: number) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const n = 5, g = new THREE.BoxGeometry(w, h, d, n, n, n);
  const p = g.attributes.position as THREE.BufferAttribute, nr = g.attributes.normal as THREE.BufferAttribute;
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r, v = new THREE.Vector3(), c = new THREE.Vector3(), dv = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -ix, ix), clamp(v.y, -iy, iy), clamp(v.z, -iz, iz));
    dv.copy(v).sub(c);
    if (dv.lengthSq() > 1e-10) {
      dv.normalize();
      nr.setXYZ(i, dv.x, dv.y, dv.z);
      v.copy(c).addScaledVector(dv, r);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return g;
}

// Cached geometry helpers.
export const RB = (w: number, h: number, d: number, r = 0.1) => geo('rb' + [w, h, d, r], () => roundedBox(w, h, d, r));
export const Cap = (r: number, l: number) => geo('cp' + r + '|' + l, () => new THREE.CapsuleGeometry(r, l, 6, 14));
export const Sph = (r: number) => geo('sp' + r, () => new THREE.SphereGeometry(r, 22, 16));
export const Cyl = (a: number, b: number, h: number, s = 22) => geo('cy' + [a, b, h, s], () => new THREE.CylinderGeometry(a, b, h, s));
export const Cone = (r: number, h: number, s = 16) => geo('cn' + [r, h, s], () => new THREE.ConeGeometry(r, h, s));
export const Tri = (w: number, h: number, d: number) => geo('tr' + [w, h, d], () => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
});

export type Vec3 = [number, number, number];
export interface PartOpts {
  /** Outline thickness, or false for none. Defaults to 0.028. */
  ol?: number | false;
  shadow?: boolean;
  s?: number | Vec3;
  r?: Vec3;
}

/** A cel-shaded mesh with an ink outline child. */
export function part(g: THREE.BufferGeometry, color: string | THREE.Material, parent: THREE.Object3D | null,
  x = 0, y = 0, z = 0, o: PartOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(g, typeof color === 'string' ? T(color) : color);
  m.position.set(x, y, z);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  if (o.ol !== false) {
    const ol = new THREE.Mesh(g, olMat(o.ol || 0.028));
    ol.raycast = () => {};
    m.add(ol);
  }
  if (o.s) Array.isArray(o.s) ? m.scale.set(...o.s) : m.scale.setScalar(o.s);
  if (o.r) m.rotation.set(...o.r);
  if (parent) parent.add(m);
  return m;
}

const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const ETX: Record<string, THREE.CanvasTexture> = {};
export function emojiTex(ch: string) {
  if (ETX[ch]) return ETX[ch];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.font = '96px ' + EMOJI; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ch, 64, 70);
  return (ETX[ch] = new THREE.CanvasTexture(c));
}
export function emojiSprite(ch: string, s: number) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(ch), transparent: true, depthWrite: false }));
  sp.scale.set(s, s, 1);
  return sp;
}
