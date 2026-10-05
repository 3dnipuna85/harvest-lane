import * as THREE from 'three';
import { ctx } from '../context';

/** HTML labels positioned over the 3D view. Call lbl() every frame a label should show; unused ones hide. */
interface Label extends HTMLDivElement { _h: string | null; _c: string | null; _used: boolean }
const LBL = new Map<string, Label>();
const tmpV = new THREE.Vector3();
/** While in Market Town the farm keeps running but its labels stay hidden, and labels project with the town camera. */
let muted = false;
let cam: THREE.Camera | null = null;
export function muteLabels(on: boolean) { muted = on; }
export function labelCamera(c: THREE.Camera | null) { cam = c; }

export function lbl(key: string, html: string, wpos: THREE.Vector3, cls = '') {
  if (muted) return;
  let e = LBL.get(key);
  if (!e) {
    e = document.createElement('div') as Label;
    ctx.overlay.appendChild(e);
    LBL.set(key, e);
    e._h = null; e._c = null;
  }
  if (e._c !== cls) { e.className = 'lbl ' + cls; e._c = cls; }
  if (e._h !== html) { e.innerHTML = html; e._h = html; }
  tmpV.copy(wpos).project(cam || ctx.camera);
  e.style.transform = `translate(${(((tmpV.x + 1) / 2) * ctx.CW).toFixed(1)}px,${(((1 - tmpV.y) / 2) * ctx.CH).toFixed(1)}px) translate(-50%,-50%)`;
  e._used = true;
  e.hidden = false;
}

export function beginLabels() { for (const e of LBL.values()) e._used = false; }
export function endLabels() { for (const e of LBL.values()) if (!e._used) e.hidden = true; }
export function clearLabels() { for (const e of LBL.values()) e.remove(); LBL.clear(); }

/** World position to page (client) coordinates. */
export function toScreen(v: THREE.Vector3): [number, number] {
  if (!ctx.ok3d) return [innerWidth / 2, innerHeight / 2];
  const r = ctx.cvs.getBoundingClientRect();
  tmpV.copy(v).project(cam || ctx.camera);
  return [r.left + ((tmpV.x + 1) / 2) * r.width, r.top + ((1 - tmpV.y) / 2) * r.height];
}
