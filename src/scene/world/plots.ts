import * as THREE from 'three';
import { CROPS } from '../../data/crops';
import { growProgress, plotCost, plotLvl, plotSlot, rotIn } from '../../game/economy';
import { S } from '../../game/state';
import { coinHTML, fmt } from '../../ui/format';
import { isQueued } from '../actors/ai';
import { ctx } from '../context';
import { Cap, RB, part } from '../geometry';
import { PSZ, plotPos } from '../layout';
import { T } from '../materials';
import { lbl } from '../fx/labels';
import { sparkle } from '../fx/particles';
import { buildCrop, type Stage } from './crops';

interface PlotView {
  g: THREE.Group;
  ripeF: THREE.Group;
  queueF: THREE.Group;
  crops: THREE.Group | null;
  key: string;
  spark: number;
  pop: number;
}

let P3: PlotView[] = [];
let buySlot: THREE.Group;

/** A glowing frame around a plot (ripe = yellow, queued = white). */
function frame4(color: string, parent: THREE.Object3D, y: number) {
  const g = new THREE.Group(), m = T(color, { emissive: color, emissiveIntensity: 0.5 });
  for (const [w, d, x, z] of [[PSZ + 0.1, 0.12, 0, PSZ / 2 + 0.05], [PSZ + 0.1, 0.12, 0, -PSZ / 2 - 0.05], [0.12, PSZ + 0.1, PSZ / 2 + 0.05, 0], [0.12, PSZ + 0.1, -PSZ / 2 - 0.05, 0]]) {
    part(RB(w, 0.12, d, 0.05), m, g, x, y, z, { ol: false, shadow: false });
  }
  g.visible = false;
  parent.add(g);
  return g;
}

function buildPlot(i: number): PlotView {
  const q = plotPos(i), g = new THREE.Group();
  g.position.set(q.x, 0, q.z);
  g.userData = { type: 'plot', i };
  part(RB(PSZ, 0.3, PSZ, 0.13), '#8a5530', g, 0, 0.15, 0, { shadow: false });
  for (const z of [-0.5, 0.5]) {
    const m = part(Cap(0.27, 1.4), '#6e4022', g, 0, 0.3, z, { ol: 0.02, shadow: false });
    m.rotation.z = Math.PI / 2; m.scale.set(1, 1, 0.9);
  }
  const ripeF = frame4('#ffd84a', g, 0.33);
  const queueF = frame4('#ffffff', g, 0.36);
  ctx.scene.add(g);
  ctx.pickables.push(g);
  return { g, ripeF, queueF, crops: null, key: '', spark: 0, pop: 0 };
}

/** Called from initScene(): forget old plot meshes and create the "buy plot" ghost slot. */
export function initPlots() {
  P3 = [];
  buySlot = new THREE.Group();
  buySlot.userData = { type: 'buy' };
  const bm = new THREE.Mesh(RB(PSZ, 0.12, PSZ, 0.1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }));
  bm.position.y = 0.06;
  buySlot.add(bm);
  ctx.scene.add(buySlot);
  ctx.pickables.push(buySlot);
}

export function syncPlots() {
  if (P3.length === S.plots.length && buySlot.userData.n === S.plots.length) return;
  while (P3.length < S.plots.length) P3.push(buildPlot(P3.length));
  while (P3.length > S.plots.length) {
    const p = P3.pop()!;
    ctx.scene.remove(p.g);
    ctx.pickables.splice(ctx.pickables.indexOf(p.g), 1);
  }
  if (plotSlot()) { const q = plotPos(S.plots.length); buySlot.position.set(q.x, 0, q.z); buySlot.visible = true; }
  else buySlot.visible = false;
  buySlot.userData.n = S.plots.length;
}

const tmp = new THREE.Vector3();
export function updatePlots(t: number, dt: number) {
  for (let i = 0; i < P3.length; i++) {
    const P = P3[i], p = S.plots[i], q = plotPos(i);
    let stage: Stage | 'none' = 'none';
    const pr = growProgress(p);
    const rl = rotIn(p);
    if (p.crop) stage = rl <= 0 ? 'rotten' : pr >= 1 ? 'ripe' : pr < 0.3 ? 'sprout' : 'grow';
    const key = (p.crop || '') + stage;
    if (P.key !== key) {
      if (P.crops) P.g.remove(P.crops);
      P.crops = stage === 'none' ? null : buildCrop(p.crop!, stage);
      if (P.crops) P.g.add(P.crops);
      P.key = key;
      if (stage === 'ripe') P.pop = 0.35;
    }
    if (P.crops) {
      if (stage === 'ripe') {
        // pop in, then bounce gently and sparkle
        P.pop = Math.max(0, P.pop - dt);
        const s = 1.25 + Math.sin((P.pop / 0.35) * Math.PI) * 0.25;
        P.crops.scale.set(s, s * (1 + Math.sin(t * 5 + i) * 0.04), s);
        P.spark -= dt;
        if (P.spark <= 0) { sparkle(q.x + (Math.random() - 0.5) * 1.6, q.z + (Math.random() - 0.5) * 1.4); P.spark = 0.5 + Math.random() * 0.6; }
      } else {
        const s = stage === 'sprout' ? 1 + pr * 1.5 : (0.5 + 0.5 * pr) * 1.25;
        P.crops.scale.setScalar(s);
      }
    }
    P.ripeF.visible = stage === 'ripe';
    if (stage === 'ripe' && rl < 120_000) lbl('t' + i, `🥀 ${Math.ceil(rl / 1000)}s`, tmp.set(q.x, 0.5, q.z + 1.05), 'timer rotsoon');
    if (stage === 'rotten') lbl('t' + i, 'Rotten', tmp.set(q.x, 0.5, q.z + 1.05), 'timer rotten');
    P.queueF.visible = isQueued(i);
    if (P.queueF.visible) P.queueF.position.y = Math.sin(t * 6) * 0.04;
    if (stage === 'sprout' || stage === 'grow') {
      lbl('t' + i, `<span>${Math.ceil(CROPS[p.crop!].time * (1 - pr))}s</span><b><i style="width:${(pr * 100).toFixed(0)}%"></i></b>`,
        tmp.set(q.x, 0.5, q.z + 1.05), 'timer');
    }
  }
  if (buySlot.visible) {
    const c = plotCost(), q = plotPos(S.plots.length), need = plotLvl(), locked = S.level < need;
    lbl('buy', locked ? `<span>New plot</span><span class="r">🔒 Lv ${need}</span>` : `<span>Buy plot</span><span class="r">${coinHTML}${fmt(c)}</span>`, tmp.set(q.x, 0.25, q.z), 'buy');
    ((buySlot.children[0] as THREE.Mesh).material as THREE.Material).opacity = !locked && S.coins >= c ? 0.55 : 0.25;
  }
}
