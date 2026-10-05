import * as THREE from 'three';
import { now } from '../../game/clock';
import { canFillContract } from '../../game/contracts';
import { inv } from '../../game/economy';
import { S, type Contract } from '../../game/state';
import { iconHTML } from '../../ui/art';
import { coinHTML, fmt } from '../../ui/format';
import { ctx } from '../context';
import { lbl } from '../fx/labels';
import { dust3 } from '../fx/particles';
import { ROADZ } from '../layout';
import { Cyl, part, RB, Sph } from './smooth';
import type { ItemId } from '../../data/goods';

/**
 * The contract lorry: a blue wholesale box truck that pulls off the road onto the verge by the animal pen and
 * waits there for machine goods. It comes in from the west along the road and backs out the same way.
 */
export const LORRY_STOP = { x: -9.3, z: -2.25 };
const X_IN = -24, TURN_X = -12.6, DRIVE_S = 5;

let g: THREE.Group, wheels: THREE.Mesh[] = [], mode: 'gone' | 'in' | 'wait' | 'out' = 'gone', outP = 0, smoke = 0;

function build() {
  g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  part(RB(3.2, 0.24, 1.25, 0.08), '#3a3a44', body, 0, 0.44, 0);
  // cab
  part(RB(0.9, 1.05, 1.22, 0.18), '#2f6fd6', body, 1.15, 1.06, 0);
  part(RB(0.08, 0.46, 0.96, 0.04), '#bfe6ff', body, 1.6, 1.3, 0, { ol: false });
  for (const z of [-0.6, 0.6]) part(RB(0.46, 0.36, 0.04, 0.03), '#bfe6ff', body, 1.18, 1.32, z, { ol: false });
  for (const z of [-0.42, 0.42]) part(Sph(0.09), '#fff3b0', body, 1.62, 0.78, z, { ol: 0.01 });
  part(RB(0.14, 0.2, 1.26, 0.06), '#d8d4cc', body, 1.66, 0.48, 0);
  part(Sph(0.18), '#f2c49b', body, 1.12, 1.36, 0);
  part(Sph(0.19), '#f2c94c', body, 1.1, 1.46, 0, { s: [1, 0.55, 1] });
  // the box, with a gold "contract" stripe
  part(RB(2.15, 1.45, 1.3, 0.1), '#f4f1ea', body, -0.45, 1.3, 0);
  for (const z of [-0.66, 0.66]) {
    part(RB(1.9, 0.26, 0.03, 0.02), '#f2c94c', body, -0.45, 1.25, z, { ol: false });
    part(RB(1.9, 0.08, 0.03, 0.02), '#2f6fd6', body, -0.45, 1.46, z, { ol: false });
    part(RB(1.9, 0.08, 0.03, 0.02), '#2f6fd6', body, -0.45, 1.04, z, { ol: false });
  }
  wheels = [];
  for (const x of [1.15, -0.25, -1.1]) for (const z of [-0.62, 0.62]) {
    const w = part(Cyl(0.3, 0.3, 0.22), '#2d2a28', g, x, 0.3, z);
    w.rotation.x = Math.PI / 2;
    part(Cyl(0.13, 0.13, 0.24), '#d8d4cc', w, 0, 0, 0, { ol: false });
    wheels.push(w);
  }
  g.visible = false;
  g.userData.type = 'contract';
  ctx.scene.add(g);
  ctx.pickables.push(g);
}

/** Position along the route for progress p (0 = far west on the road, 1 = parked on the verge). */
function place(p: number) {
  const e = 1 - Math.pow(1 - p, 3), x = X_IN + (LORRY_STOP.x - X_IN) * e;
  const turn = Math.min(1, Math.max(0, (x - TURN_X) / (LORRY_STOP.x - TURN_X)));
  g.position.set(x, 0, ROADZ + (LORRY_STOP.z - ROADZ) * turn);
  g.rotation.y = -Math.sin(turn * Math.PI) * 0.35;
}

export function initLorry() { mode = 'gone'; build(); }

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function updateLorry(dt: number) {
  const c = S.contract, t = now();
  if (c && (mode === 'gone' || mode === 'out')) { mode = 'in'; g.visible = true; }
  if (!c && (mode === 'in' || mode === 'wait')) { mode = 'out'; outP = 1; }
  const x0 = g.position.x;
  if (mode === 'in' && c) {
    const p = Math.min(1, Math.max(0, (t - c.arrive) / (DRIVE_S * 1000)));
    place(p);
    if (p >= 1) mode = 'wait';
  } else if (mode === 'out') {
    outP -= dt / 3.5;
    place(Math.max(0, outP));
    if (outP <= 0) { mode = 'gone'; g.visible = false; }
  }
  const moved = g.position.x - x0;
  for (const w of wheels) w.rotation.y -= moved / 0.3;
  smoke -= dt;
  if (g.visible && smoke <= 0) { smoke = mode === 'wait' ? 1.2 : 0.15; dust3(g.position.x + 1.6, g.position.z + 0.45); }
  if (c && mode === 'wait') label(c, t);
}

function label(c: Contract, t: number) {
  const left = c.end - t, frac = Math.max(0, left / (c.end - c.arrive)), ready = canFillContract();
  const needs = (Object.entries(c.items) as [ItemId, number][]).map(([i, q]) =>
    `<span class="tneed ${inv(i) >= q ? 'ok' : ''}">${iconHTML(i, 'ic-need')}${Math.min(inv(i), q)}/${q}</span>`).join('');
  lbl('lorry', `<div class="r"><b>📋 Contract</b></div><div class="r">${needs}</div>
    <div class="r"><b class="tbar ${frac < 0.2 ? 'low' : ''}"><i style="width:${(frac * 100).toFixed(1)}%"></i></b><span class="tclock">${mmss(left)}</span></div>
    <div class="r tpay">${coinHTML}${fmt(c.coins)} <span class="ttip">+${c.gems} 💎</span></div>
    ${ready ? '<div class="r tgo">Tap the lorry to load it!</div>' : ''}`,
  new THREE.Vector3(g.position.x, 2.9, g.position.z), 'truck lorrylbl' + (ready ? ' ready' : '') + (frac < 0.2 ? ' hurry' : ''));
}
