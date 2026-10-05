import * as THREE from 'three';
import { ctx } from './context';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The whole island's extent in camera space. */
let full = { cx: 0, cy: 0, sx: 1, sy: 1 };
/** How far the view may pan, in camera space: the island plus the river beyond the south fence. */
let ext = { x0: -1, x1: 1, y0: -1, y1: 1 };
let tween: { x0: number; y0: number; x1: number; y1: number; t: number } | null = null;
/** Current half-width and half-height of the view, in camera units. */
export const view = { hw: 10, hh: 10 };
/** Pan offset from the island centre, in camera units. */
export const pan = { x: 0, y: 0 };
let Z = 0;
let panInit = false;

export const getZoom = () => Z;

/** Orthographic isometric camera at (24, 21, 24) looking at the origin; measure the island in its space. */
export function computeFull() {
  const camera = ctx.camera;
  camera.position.set(24, 21, 24);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const inv = camera.matrixWorldInverse, a = [1e9, -1e9, 1e9, -1e9];
  const pts: [number, number, number][] = [];
  for (const x of [-13.5, 13.5]) for (const z of [-9.8, 11]) pts.push([x, 0, z]);
  for (const x of [-13, 13]) pts.push([x, 3.6, -9.6]);
  for (const p of pts) {
    const v = new THREE.Vector3(...p).applyMatrix4(inv);
    a[0] = Math.min(a[0], v.x); a[1] = Math.max(a[1], v.x); a[2] = Math.min(a[2], v.y); a[3] = Math.max(a[3], v.y);
  }
  full = { cx: (a[0] + a[1]) / 2, cy: (a[2] + a[3]) / 2, sx: a[1] - a[0], sy: a[3] - a[2] };
  for (const x of [-23.5, 23.5]) for (const z of [-9.8, 16.8]) pts.push([x, 0, z]);
  const b = [1e9, -1e9, 1e9, -1e9];
  for (const p of pts) {
    const v = new THREE.Vector3(...p).applyMatrix4(inv);
    b[0] = Math.min(b[0], v.x); b[1] = Math.max(b[1], v.x); b[2] = Math.min(b[2], v.y); b[3] = Math.max(b[3], v.y);
  }
  ext = { x0: b[0], x1: b[1], y0: b[2], y1: b[3] };
}

/** Glide the view so a world point sits in the middle of the screen. */
export function focusOn(x: number, z: number) {
  const v = new THREE.Vector3(x, 0, z).applyMatrix4(ctx.camera.matrixWorldInverse);
  tween = { x0: pan.x, y0: pan.y, x1: v.x - full.cx, y1: v.y - full.cy, t: 0 };
}
export const cancelFocus = () => { tween = null; };

export function updateCam(dt: number) {
  if (!tween) return;
  tween.t = Math.min(1, tween.t + dt / 0.7);
  const e = tween.t * tween.t * (3 - 2 * tween.t);
  pan.x = tween.x0 + (tween.x1 - tween.x0) * e;
  pan.y = tween.y0 + (tween.y1 - tween.y0) * e;
  applyCam();
  if (tween.t >= 1) tween = null;
}

/** True when a world point is inside the view, with a margin in camera units. */
export function inView(x: number, z: number, margin = 1) {
  const v = new THREE.Vector3(x, 0, z).applyMatrix4(ctx.camera.matrixWorldInverse), c = ctx.camera;
  return v.x > c.left + margin && v.x < c.right - margin && v.y > c.bottom + margin && v.y < c.top - margin;
}

/** Fill the whole window, edge to edge. Phones start more zoomed in. */
export function resize() {
  if (!ctx.ok3d) return;
  ctx.CW = Math.max(240, ctx.wrap.clientWidth);
  ctx.CH = Math.max(240, ctx.wrap.clientHeight);
  const zoomed = ctx.CW < 560;
  ctx.renderer.setSize(ctx.CW, ctx.CH);
  if (!Z) Z = zoomed ? 2.3 : ctx.CW < ctx.CH ? 2.1 : 1.75;
  if (!panInit) {
    // Start centred near the field and barn.
    const v = new THREE.Vector3(-2.6, 0, -2.4).applyMatrix4(ctx.camera.matrixWorldInverse);
    pan.x = v.x - full.cx; pan.y = v.y - full.cy;
    panInit = true;
  }
  applyCam();
  ctx.cvs.style.touchAction = 'none';
}

export function setZoom(z: number) { Z = clamp(z, 1, 2.8); applyCam(); }

export function applyCam() {
  const camera = ctx.camera, asp = ctx.CW / ctx.CH;
  let hw = (full.sx / 2) * 1.02 / Z, hh = (full.sy / 2) * 1.02 / Z;
  if (hw / hh < asp) hw = hh * asp; else hh = hw / asp;
  view.hw = hw; view.hh = hh;
  const fit = (v: number, a: number, b: number, h: number) => (a + h > b - h ? (a + b) / 2 : clamp(v, a + h, b - h));
  const cx = fit(full.cx + pan.x, ext.x0, ext.x1, view.hw), cy = fit(full.cy + pan.y, ext.y0, ext.y1, view.hh);
  pan.x = cx - full.cx; pan.y = cy - full.cy;
  camera.left = cx - view.hw; camera.right = cx + view.hw; camera.top = cy + view.hh; camera.bottom = cy - view.hh;
  camera.updateProjectionMatrix();
}
