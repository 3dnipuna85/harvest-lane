import * as THREE from 'three';
import { ctx } from './context';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The whole island's extent in camera space. */
let full = { cx: 0, cy: 0, sx: 1, sy: 1 };
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
}

/** Fit the canvas to its container. Phones get a taller, more zoomed-in view. */
export function resize() {
  if (!ctx.ok3d) return;
  ctx.CW = Math.max(240, ctx.wrap.clientWidth);
  const zoomed = ctx.CW < 560;
  let h = zoomed ? ctx.CW * 1.1 : ctx.CW * 0.72;
  h = Math.min(h, Math.max(340, innerHeight * 0.8));
  ctx.CH = Math.round(h);
  ctx.renderer.setSize(ctx.CW, ctx.CH);
  if (!Z) Z = zoomed ? 2.3 : 1.75;
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
  const mx = Math.max(0, full.sx / 2 - view.hw), my = Math.max(0, full.sy / 2 - view.hh);
  pan.x = clamp(pan.x, -mx, mx); pan.y = clamp(pan.y, -my, my);
  const cx = full.cx + pan.x, cy = full.cy + pan.y;
  camera.left = cx - view.hw; camera.right = cx + view.hw; camera.top = cy + view.hh; camera.bottom = cy - view.hh;
  camera.updateProjectionMatrix();
}
