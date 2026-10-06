import * as THREE from 'three';
import { GOODS } from '../../data/goods';
import { MACHINES, MACHINE_IDS, type MachineId } from '../../data/machines';
import { now } from '../../game/clock';
import { S } from '../../game/state';
import { coinHTML, fmt } from '../../ui/format';
import { ctx } from '../context';
import { Cap, Cyl, RB, Sph, Tri, emojiSprite, part } from '../geometry';
import { BX, BZ } from '../layout';
import { T } from '../materials';
import { lbl } from '../fx/labels';
import { dust3, smoke3 } from '../fx/particles';

/** Where workshop id stands: beside the barn for the first row, or its own spot in the back row. */
export const wsPos = (id: MachineId) => MACHINES[id].at ?? { x: BX[MACHINE_IDS.indexOf(id) + 1], z: BZ };

type SlotState = 'locked' | 'lot' | 'owned';
interface Slot { root: THREE.Group; st: SlotState | null; inner: THREE.Group | null; pop: number; puffT: number }
let slots: Slot[] = [];

/** A finished workshop, or a building lot with a sign and crates when not yet owned. */
function workshopModel(id: MachineId, owned: boolean) {
  const d = MACHINES[id], g = new THREE.Group();
  if (!owned) {
    part(Cap(0.07, 1.0), '#9a6438', g, -0.45, 0.65, 0.6);
    part(Cap(0.07, 1.0), '#9a6438', g, 0.45, 0.65, 0.6);
    part(RB(1.4, 0.62, 0.12, 0.08), '#f3d9a4', g, 0, 1.1, 0.62);
    for (const [x, z] of [[-0.8, -0.3], [0.7, -0.5], [0.2, 0.0]]) part(RB(0.32, 0.32, 0.32, 0.06), '#c98f55', g, x, 0.16, z);
    return g;
  }
  part(RB(2.2, 1.3, 1.9, 0.14), d.wall, g, 0, 0.65, 0);
  for (const s of [-1, 1]) part(RB(1.45, 0.16, 2.2, 0.07), d.roof, g, s * 0.55, 1.62, 0, { r: [0, 0, -s * 0.62] });
  part(Tri(2.05, 0.75, 1.88), d.wall, g, 0, 1.27, 0, { ol: false });
  part(RB(0.34, 0.8, 0.34, 0.08), '#b0a294', g, 0.6, 1.85, -0.45);
  part(RB(0.5, 0.86, 0.1, 0.1), '#7a4a2a', g, -0.55, 0.45, 0.96);
  const win = part(Cyl(0.24, 0.24, 0.08, 20), '#cfeaf7', g, 0.45, 0.8, 0.96);
  win.rotation.x = Math.PI / 2;
  g.userData.win = win;
  part(RB(2.3, 0.12, 0.5, 0.06), '#fff7ea', g, 0, 1.3, 1.0);
  const sp = emojiSprite(GOODS[d.out].icon, 0.62);
  sp.position.set(0, 1.62, 1.15); g.add(sp);
  part(RB(0.36, 0.36, 0.36, 0.07), '#c98f55', g, 1.35, 0.18, 0.75);
  part(RB(0.28, 0.28, 0.28, 0.06), '#b57c45', g, 1.38, 0.5, 0.72);
  return g;
}

export function initWorkshops() {
  slots = MACHINE_IDS.map(id => {
    const root = new THREE.Group();
    const p = wsPos(id);
    root.position.set(p.x, 0, p.z);
    root.userData = { type: 'bld', id };
    ctx.scene.add(root);
    ctx.pickables.push(root);
    return { root, st: null, inner: null, pop: 0, puffT: 0 };
  });
}

/** Rebuild a slot's model when it changes between locked, empty lot and owned. */
export function syncBuildings() {
  MACHINE_IDS.forEach((id, j) => {
    const d = MACHINES[id], m = S.machines[id], slot = slots[j];
    const st: SlotState = d.lvl > S.level ? 'locked' : m.owned ? 'owned' : 'lot';
    if (slot.st === st) return;
    const was = slot.st;
    slot.st = st;
    slot.root.clear();
    slot.inner = null;
    if (st === 'locked') {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        part(Sph(0.16), '#c9c3b5', slot.root, Math.cos(a) * 1.05, 0.06, Math.sin(a) * 0.85, { s: [1, 0.55, 1], ol: 0.015 });
      }
    } else {
      slot.inner = workshopModel(id, st === 'owned');
      slot.root.add(slot.inner);
      if (was && st === 'owned') {
        slot.pop = 0.5;
        const p = wsPos(id);
        for (let k = 0; k < 14; k++) dust3(p.x + (Math.random() - 0.5) * 2.2, p.z + (Math.random() - 0.5) * 1.8);
      }
    }
  });
}

const tmp = new THREE.Vector3();
const winOn = () => T('#ffe27a', { emissive: '#ffb300', emissiveIntensity: 0.8 });

export function updateBuildings(dt: number) {
  MACHINE_IDS.forEach((id, j) => {
    const d = MACHINES[id], m = S.machines[id], slot = slots[j], { x, z: BZ } = wsPos(id);
    if (slot.st === 'locked') { lbl('b' + j, '🔒 Lv ' + d.lvl, tmp.set(x, 0.5, BZ), 'lock'); return; }
    if (slot.st === 'lot') { lbl('b' + j, `<span>${d.name}</span><span class="r">${coinHTML}${fmt(d.cost)}</span>`, tmp.set(x, 1.15, BZ + 0.7), 'sign'); return; }
    const win = slot.inner?.userData.win as THREE.Mesh | undefined;
    if (win) win.material = m.job ? winOn() : T('#cfeaf7');
    let sy = 1, sx = 1;
    if (slot.pop > 0) {
      // pop in after being built
      slot.pop -= dt;
      const k = Math.sin((1 - slot.pop / 0.5) * Math.PI);
      sy = 1 + k * 0.18; sx = 1 - k * 0.06;
    }
    if (m.job) {
      slot.puffT -= dt;
      if (slot.puffT <= 0) { smoke3(x + 0.6, 2.35, BZ - 0.45); slot.puffT = 0.32; }
      const pr = Math.min(1, (now() - m.job.start) / (m.job.end - m.job.start));
      sy *= 1 + Math.sin(now() / 85) * 0.025;
      sx *= 1 - Math.sin(now() / 85) * 0.012;
      lbl('b' + j, `<i style="width:${(pr * 100).toFixed(0)}%"></i>`, tmp.set(x, 3.0, BZ), 'bar');
    } else if (!m.on) lbl('b' + j, 'Paused', tmp.set(x, 2.8, BZ), 'lock');
    slot.root.scale.set(sx, sy, sx);
  });
}

/** Where a workshop's finished goods start their flight to the barn. */
export const workshopDoor = (id: MachineId) => { const p = wsPos(id); return new THREE.Vector3(p.x, 1.2, p.z + 1.1); };
