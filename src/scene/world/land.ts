import * as THREE from 'three';
import { LAND } from '../../data/land';
import { MAX_PLOTS } from '../../data/limits';
import { S } from '../../game/state';
import { coinHTML, fmt } from '../../ui/format';
import { ctx } from '../context';
import { Cap, Cone, RB, Sph, instanced, mat, part } from '../geometry';
import { parcelBox } from '../layout';
import { lbl } from '../fx/labels';

/** Land parcels beyond the fence: staked-out wild grass with a "For sale" sign, then a tilled field once bought. */

interface ParcelView { wild: THREE.Group; field: THREE.Group; sign: THREE.Group; owned: boolean | null }
let views: ParcelView[] = [];

function wildGround(k: number) {
  const b = parcelBox(k), g = new THREE.Group();
  // corner and edge stakes with a rope between them
  const stakes: { m: THREE.Matrix4 }[] = [];
  const corners: [number, number][] = [[-b.hw, -b.hd], [b.hw, -b.hd], [b.hw, b.hd], [-b.hw, b.hd]];
  for (let s = 0; s < 4; s++) {
    const [x0, z0] = corners[s], [x1, z1] = corners[(s + 1) % 4], L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 2.2);
    for (let i = 0; i < n; i++) stakes.push({ m: mat(b.x + x0 + ((x1 - x0) * i) / n, 0.3, b.z + z0 + ((z1 - z0) * i) / n) });
    const r = part(Cap(0.025, L), '#f3e1b0', g, b.x + (x0 + x1) / 2, 0.45, b.z + (z0 + z1) / 2, { ol: false, shadow: false });
    r.rotation.set(Math.PI / 2, 0, 0); r.rotation.y = Math.atan2(x1 - x0, z1 - z0); r.rotation.order = 'YXZ';
  }
  instanced(Cap(0.06, 0.45), '#c98f55', stakes, g, 0.015);
  // tall wild grass, weeds and a few stones
  const tufts: { m: THREE.Matrix4; c: string }[] = [], stones: { m: THREE.Matrix4; c: string }[] = [], blooms: { m: THREE.Matrix4; c: string }[] = [];
  for (let i = 0; i < 70; i++) {
    const x = b.x + (Math.random() * 2 - 1) * (b.hw - 0.3), z = b.z + (Math.random() * 2 - 1) * (b.hd - 0.3), h = 0.6 + Math.random() * 0.5;
    tufts.push({ m: mat(x, h / 2, z, [1, h / 0.8, 1], [0, Math.random() * 3, (Math.random() - 0.5) * 0.3]), c: ['#5fae3d', '#4f9a3a', '#78c24c'][i % 3] });
    if (i % 5 === 0) blooms.push({ m: mat(x + 0.1, h + 0.02, z), c: ['#ffffff', '#ffd84a', '#ff8fbf'][i % 3] });
  }
  for (let i = 0; i < 6; i++) stones.push({ m: mat(b.x + (Math.random() * 2 - 1) * b.hw * 0.8, 0.1, b.z + (Math.random() * 2 - 1) * b.hd * 0.8, [1.1, 0.6, 0.9], [0, i, 0]), c: i % 2 ? '#a9a59a' : '#c4bfb2' });
  instanced(Cone(0.16, 0.8, 6), '#ffffff', tufts, g, false);
  instanced(Sph(0.07), '#ffffff', blooms, g, false, false);
  instanced(Sph(0.3), '#ffffff', stones, g, 0.015);
  return g;
}

function tilledField(k: number) {
  const b = parcelBox(k), g = new THREE.Group();
  part(RB(b.hw * 2 + 0.3, 0.05, b.hd * 2 + 0.3, 0.6), '#7f9a3c', g, b.x, 0.012, b.z, { ol: false, shadow: false });
  part(RB(b.hw * 2, 0.05, b.hd * 2, 0.5), '#8fb04a', g, b.x, 0.02, b.z, { ol: false, shadow: false });
  return g;
}

/** A wooden "For sale" sign on the road side of the parcel. Tapping it buys the land. */
function forSale(k: number) {
  const b = parcelBox(k), g = new THREE.Group();
  g.position.set(b.x, 0, b.z - b.hd - 0.2);
  for (const s of [-1, 1]) part(Cap(0.07, 1.1), '#8a5a36', g, s * 0.55, 0.6, 0, { ol: 0.012 });
  part(RB(1.5, 0.75, 0.1, 0.06), '#e6b56c', g, 0, 1.15, 0);
  part(RB(1.3, 0.16, 0.12, 0.04), '#c2412f', g, 0, 1.38, 0.01, { ol: false });
  g.userData = { type: 'land', k };
  ctx.pickables.push(g);
  return g;
}

export function initLand() {
  views = LAND.map((_, k) => {
    const wild = wildGround(k), field = tilledField(k), sign = forSale(k);
    ctx.scene.add(wild, field, sign);
    return { wild, field, sign, owned: null };
  });
}

const tmp = new THREE.Vector3();
export function updateLand() {
  views.forEach((v, k) => {
    const owned = k < S.land;
    if (owned !== v.owned) {
      v.owned = owned;
      v.wild.visible = v.sign.visible = !owned;
      v.field.visible = owned;
    }
    if (owned) return;
    const p = LAND[k], b = parcelBox(k), pos = tmp.set(b.x, 1.9, b.z - b.hd - 0.2);
    if (k > S.land) {
      lbl('land' + k, `<b>${p.name}</b><span class="r">${coinHTML}${fmt(p.cost)}</span><span class="note">Buy ${LAND[k - 1].name} first</span>`, pos, 'sign land locked');
      return;
    }
    const pct = Math.min(100, (S.coins / p.cost) * 100);
    const note = S.level < p.lvl ? `Reach level ${p.lvl}`
      : S.plots.length < MAX_PLOTS ? 'Fill your home field first'
      : S.coins >= p.cost ? 'Tap to buy!' : `Save ${fmt(p.cost - S.coins)} more`;
    lbl('land' + k, `<b>${p.name}</b><span class="r">${coinHTML}${fmt(p.cost)} · 12 plots</span>
      <span class="save"><i style="width:${pct.toFixed(1)}%"></i></span><span class="note">${note}</span>`, pos, 'sign land' + (note === 'Tap to buy!' ? ' ready' : ''));
  });
}
