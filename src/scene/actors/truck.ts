import * as THREE from 'three';
import { now } from '../../game/clock';
import { inv } from '../../game/economy';
import { orderItems } from '../../game/orders';
import { S } from '../../game/state';
import { canFillTruck, truckOffer } from '../../game/trucks';
import { iconHTML } from '../../ui/art';
import { coinHTML, fmt } from '../../ui/format';
import { ctx } from '../context';
import { lbl } from '../fx/labels';
import { dust3 } from '../fx/particles';
import { ROADZ } from '../layout';
import { Cap, Cyl, part, RB, Sph } from './smooth';

/** Where the buyer's truck parks on the road, and where it enters and leaves the map. */
export const TRUCK_STOP = { x: 6.3, z: ROADZ };
const X_IN = -18, X_OUT = 19, DRIVE_IN_S = 3.2;

type Mode = 'gone' | 'in' | 'wait' | 'out';
let g: THREE.Group, body: THREE.Group, wheels: THREE.Mesh[] = [], crates: THREE.Group;
let mode: Mode = 'gone', speed = 0, shake = 0, smoke = 0;
let bubble = '', bubbleUntil = 0, bubbleCls = '';

function build() {
  g = new THREE.Group();
  body = new THREE.Group();
  g.add(body);
  // chassis and bumpers
  part(RB(2.7, 0.22, 1.2, 0.08), '#5b4a3c', body, 0, 0.42, 0);
  part(RB(0.14, 0.2, 1.24, 0.06), '#d8d4cc', body, 1.4, 0.42, 0);
  part(RB(0.14, 0.2, 1.24, 0.06), '#d8d4cc', body, -1.4, 0.42, 0);
  // cab at the front (+x)
  part(RB(0.95, 0.62, 1.16, 0.16), '#e2463a', body, 0.86, 0.84, 0);
  part(RB(0.78, 0.6, 1.1, 0.18), '#e2463a', body, 0.78, 1.36, 0);
  part(RB(0.08, 0.42, 0.9, 0.04), '#bfe6ff', body, 1.18, 1.38, 0, { ol: false });
  for (const z of [-0.56, 0.56]) part(RB(0.5, 0.36, 0.04, 0.03), '#bfe6ff', body, 0.78, 1.4, z, { ol: false });
  part(RB(0.84, 0.08, 1.14, 0.04), '#c2362b', body, 0.78, 1.69, 0);
  for (const z of [-0.4, 0.4]) part(Sph(0.09), '#fff3b0', body, 1.33, 0.86, z, { ol: 0.01 });
  part(RB(0.06, 0.18, 0.6, 0.03), '#9a9a9a', body, 1.34, 0.66, 0, { ol: false });
  // driver: face in the window with a cap
  part(Sph(0.2), '#f2c49b', body, 0.74, 1.42, 0);
  part(Sph(0.21), '#2f6fd6', body, 0.72, 1.53, 0, { s: [1, 0.55, 1] });
  part(RB(0.16, 0.04, 0.3, 0.02), '#2f6fd6', body, 0.92, 1.5, 0, { ol: false });
  // cargo bed with wooden slat sides
  part(RB(1.65, 0.12, 1.16, 0.04), '#b9773f', body, -0.55, 0.6, 0);
  for (const z of [-0.56, 0.56]) {
    for (const y of [0.78, 0.98]) part(RB(1.62, 0.1, 0.06, 0.03), '#d99a55', body, -0.55, y, z, { ol: 0.01 });
  }
  part(RB(0.06, 0.32, 1.1, 0.03), '#d99a55', body, -1.36, 0.86, 0, { ol: 0.01 });
  // crates on the bed, filled when the order is loaded
  crates = new THREE.Group();
  crates.position.set(-0.55, 0.88, 0);
  for (const [x, z] of [[-0.42, -0.24], [0.1, 0.24], [0.42, -0.2]]) {
    part(RB(0.42, 0.34, 0.42, 0.05), '#c98a4b', crates, x, 0, z, { ol: 0.012 });
    part(Sph(0.1), ['#f2c94c', '#e64a3b', '#7cc94f'][Math.floor((x + 1) * 1.5) % 3], crates, x, 0.2, z, { ol: false });
  }
  body.add(crates);
  // wheels
  wheels = [];
  for (const x of [0.86, -0.85]) for (const z of [-0.6, 0.6]) {
    const w = part(Cyl(0.27, 0.27, 0.2), '#2d2a28', g, x, 0.28, z);
    w.rotation.x = Math.PI / 2;
    part(Cyl(0.12, 0.12, 0.22), '#d8d4cc', w, 0, 0, 0, { ol: false });
    wheels.push(w);
  }
  part(Cap(0.04, 0.2), '#777', body, -1.45, 0.42, 0.45, { r: [0, 0, Math.PI / 2], ol: false });
  g.position.set(X_IN, 0, TRUCK_STOP.z);
  g.visible = false;
  g.userData.type = 'truck';
  ctx.scene.add(g);
  ctx.pickables.push(g);
}

export function initTruck() {
  mode = 'gone';
  bubble = '';
  build();
}

/** A speech bubble over the driver for a few seconds. */
export function truckSay(text: string, cls = '', secs = 2.8) {
  bubble = text; bubbleCls = cls; bubbleUntil = performance.now() + secs * 1000;
}

/** The driver lost patience: rattle the truck before it leaves. */
export function truckAngry() { shake = 1.1; }

export function truckPos() { return new THREE.Vector3(g.position.x, 1.6, g.position.z); }

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function updateTruck(dt: number) {
  const k = S.truck, t = now();
  if (k && (mode === 'gone' || mode === 'out')) {
    // A truck that arrived while the game was closed is already parked.
    const parked = t - k.arrive > DRIVE_IN_S * 1000;
    mode = parked ? 'wait' : 'in';
    g.position.x = parked ? TRUCK_STOP.x : X_IN;
    g.visible = true;
    crates.visible = false;
  }
  if (!k && (mode === 'in' || mode === 'wait') && shake <= 0) { mode = 'out'; speed = 0; }

  const x0 = g.position.x;
  if (mode === 'in' && k) {
    // Timed from the arrival stamp so a slow frame rate never leaves the truck stuck on the road.
    const p = Math.min(1, Math.max(0, (t - k!.arrive) / (DRIVE_IN_S * 1000))), e = 1 - Math.pow(1 - p, 3);
    g.position.x = X_IN + (TRUCK_STOP.x - X_IN) * e;
    if (p >= 1) mode = 'wait';
  } else if (mode === 'out') {
    speed = Math.min(9, speed + dt * 5);
    g.position.x += speed * dt;
    if (g.position.x > X_OUT) { mode = 'gone'; g.visible = false; }
  }
  const moved = g.position.x - x0;
  for (const w of wheels) w.rotation.y -= moved / 0.27;
  const tt = performance.now() / 1000;
  body.position.y = mode === 'wait' ? Math.sin(tt * 9) * 0.006 : Math.abs(Math.sin(tt * 14)) * 0.03 * Math.min(1, Math.abs(moved) * 20);
  if (shake > 0) {
    shake -= dt;
    body.rotation.x = Math.sin(tt * 45) * 0.05 * Math.min(1, shake * 2);
  } else body.rotation.x = 0;
  smoke -= dt;
  if (g.visible && smoke <= 0 && mode !== 'gone') {
    smoke = mode === 'wait' ? 0.9 : 0.12;
    dust3(g.position.x - 1.55, g.position.z + 0.45);
  }
  crates.visible = mode === 'out' && !!lastLoaded;

  if (!g.visible) return;
  const above = new THREE.Vector3(g.position.x + 0.2, 2.5, g.position.z);
  if (performance.now() < bubbleUntil) {
    lbl('truck-say', bubble, new THREE.Vector3(g.position.x + 0.7, 2.25, g.position.z), 'say ' + bubbleCls);
    above.y = 3.25;
  }
  if (k && mode === 'wait') {
    const left = k.end - t, frac = Math.max(0, left / (k.end - k.arrive)), ready = canFillTruck();
    const { coins, tip } = truckOffer(t);
    const needs = orderItems(k).map(([i, q]) =>
      `<span class="tneed ${inv(i) >= q ? 'ok' : ''}">${iconHTML(i, 'ic-need')}${Math.min(inv(i), q)}/${q}</span>`).join('');
    lbl('truck', `<div class="r">${needs}</div>
      <div class="r"><b class="tbar ${frac < 0.25 ? 'low' : ''}"><i style="width:${(frac * 100).toFixed(1)}%"></i></b><span class="tclock">${mmss(left)}</span></div>
      <div class="r tpay">${coinHTML}${fmt(coins)}${tip ? ` <span class="ttip">+${fmt(tip)} fast tip</span>` : ''}</div>
      ${ready ? '<div class="r tgo">Tap the truck to load it!</div>' : ''}`, above, 'truck' + (ready ? ' ready' : '') + (frac < 0.25 ? ' hurry' : ''));
  }
}

/** Remember whether the truck leaving was loaded, so it drives off full or empty. */
let lastLoaded = false;
export function truckLeaving(loaded: boolean) { lastLoaded = loaded; }
