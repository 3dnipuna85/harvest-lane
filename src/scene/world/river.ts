import * as THREE from 'three';
import { ctx } from '../context';
import { Cap, Cone, Cyl, RB, Sph, instanced, mat, part } from '../geometry';
import { DOCK, RIVER_HW, riverZ } from '../layout';
import { T, toonGrad } from '../materials';
import { splash3 } from '../fx/particles';

/** The river along the south edge: flowing water, sandy banks, reeds, a fishing dock and a little rowboat. */

const X0 = -44, X1 = 44;
let waterTex: THREE.CanvasTexture;
let boat: THREE.Group;
let jumper: THREE.Group;
let jumpT = 0, jumpNext = 3, jumpX = 0;

/** A strip that follows the river's curve, from `inner` to `outer` either side of the centre line. */
function ribbon(hw: number, y: number, uvScale: number) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const step = 0.5;
  let n = 0;
  for (let x = X0; x <= X1 + 1e-6; x += step) {
    const zc = riverZ(x);
    pos.push(x, y, zc - hw, x, y, zc + hw);
    uv.push(x / uvScale, 0, x / uvScale, 1);
    if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    n++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Blue water with soft light streaks; scrolled along x so the river flows. */
function waterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d')!;
  const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#3fb4e8'); gr.addColorStop(0.5, '#58c8f2'); gr.addColorStop(1, '#3fb4e8');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const px = Math.random() * 256, py = 14 + Math.random() * 100, L = 14 + Math.random() * 34;
    x.lineWidth = 2 + Math.random() * 3;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L / 2, py - 3, px + L, py); x.stroke();
    if (px + L > 256) { x.beginPath(); x.moveTo(px - 256, py); x.quadraticCurveTo(px - 256 + L / 2, py - 3, px - 256 + L, py); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function dock(g: THREE.Object3D) {
  const d = new THREE.Group();
  d.position.set(DOCK.x, 0, 0);
  g.add(d);
  const L = DOCK.z1 - DOCK.z0, n = Math.round(L / 0.34);
  for (let k = 0; k <= n; k++) part(RB(1.15, 0.09, 0.3, 0.03), k % 2 ? '#c08a52' : '#b07a44', d, 0, 0.3, DOCK.z0 + (k * L) / n, { ol: 0.015 });
  for (const s of [-1, 1]) {
    part(RB(0.08, 0.08, L + 0.3, 0.02), '#8a5a36', d, s * 0.5, 0.22, DOCK.z0 + L / 2, { ol: false });
    for (const z of [DOCK.z0 + 0.9, DOCK.z1 - 0.6, DOCK.z1 + 0.1]) part(Cap(0.07, 0.55), '#7a4a2a', d, s * 0.55, 0.2, z, { ol: 0.012 });
  }
  // gate posts in the fence, a bait bucket and a sign
  for (const s of [-1, 1]) part(Cap(0.1, 0.8), '#fffaf0', d, s * 0.78, 0.5, 10.6, { ol: 0.02 });
  part(Cyl(0.16, 0.13, 0.26, 14), '#6e9ac0', d, 0.38, 0.48, DOCK.z0 + 0.5, { ol: 0.012 });
  part(Cyl(0.15, 0.15, 0.03, 14), '#7a5a3a', d, 0.38, 0.6, DOCK.z0 + 0.5, { ol: false });
  part(Cap(0.05, 0.8), '#8a5a36', d, -0.75, 0.5, DOCK.z0 - 0.15, { ol: 0.012 });
  const sign = part(RB(0.75, 0.36, 0.06, 0.04), '#e6b56c', d, -0.75, 1.05, DOCK.z0 - 0.1);
  sign.rotation.y = -0.2;
  d.userData.type = 'river';
  ctx.pickables.push(d);
  part(Sph(0.08), '#4cc6f2', sign, -0.18, 0, 0.04, { s: [1.5, 0.8, 0.4], ol: false, shadow: false });
  part(Cone(0.05, 0.1, 6), '#4cc6f2', sign, -0.04, 0, 0.04, { r: [0, 0, Math.PI / 2], ol: false, shadow: false });
}

function rowboat(g: THREE.Object3D) {
  boat = new THREE.Group();
  boat.position.set(DOCK.x - 2.1, 0.1, DOCK.z1 - 0.5);
  boat.rotation.y = 0.15;
  g.add(boat);
  part(RB(0.85, 0.3, 1.9, 0.28), '#c2412f', boat, 0, 0.12, 0);
  part(RB(0.7, 0.12, 1.7, 0.22), '#8a5a36', boat, 0, 0.24, 0, { ol: false });
  part(RB(0.8, 0.06, 0.22, 0.03), '#d99a55', boat, 0, 0.3, 0.2, { ol: 0.01 });
  for (const s of [-1, 1]) {
    const oar = part(Cap(0.035, 1.3), '#d9a65c', boat, s * 0.42, 0.34, 0.1, { ol: 0.01 });
    oar.rotation.set(Math.PI / 2 - 0.25, 0, s * 0.25);
  }
  // rope to the dock post
  part(Cap(0.018, 0.75), '#e8d7b0', boat, 0.55, 0.32, -0.6, { r: [0, 0, Math.PI / 2 - 0.2], ol: false, shadow: false });
}

/** Cattails and reeds along both banks, and lily pads on the water. All instanced. */
function banks(g: THREE.Object3D) {
  const stems: { m: THREE.Matrix4; c: string }[] = [], heads: { m: THREE.Matrix4; c: string }[] = [], pads: { m: THREE.Matrix4; c: string }[] = [];
  const rocks: { m: THREE.Matrix4; c: string }[] = [];
  for (let x = -26; x < 26; x += 0.55 + Math.random() * 0.9) {
    if (Math.abs(x - DOCK.x) < 1.6) continue;
    const side = Math.random() < 0.5 ? -1 : 1, zc = riverZ(x) + side * (RIVER_HW + 0.05 + Math.random() * 0.25);
    const h = 0.5 + Math.random() * 0.5;
    stems.push({ m: mat(x, h / 2, zc, [1, h / 0.6, 1], [(Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3]), c: ['#4f9a3a', '#5fae3d', '#6cbc45'][Math.floor(Math.random() * 3)] });
    if (Math.random() < 0.5) heads.push({ m: mat(x, h + 0.02, zc, [1, 1.8, 1]), c: '#8a5530' });
    if (Math.random() < 0.18) rocks.push({ m: mat(x + 0.3, 0.08, zc, [1.1, 0.55, 0.9], [0, x, 0]), c: Math.random() < 0.5 ? '#a9a59a' : '#c4bfb2' });
  }
  for (let k = 0; k < 26; k++) {
    const x = -22 + Math.random() * 44;
    if (Math.abs(x - DOCK.x) < 2) continue;
    pads.push({ m: mat(x, 0.075, riverZ(x) + (Math.random() - 0.5) * RIVER_HW * 1.4, [1, 0.12, 1]), c: Math.random() < 0.5 ? '#61b84a' : '#4fa63c' });
  }
  instanced(Cap(0.025, 0.6), '#ffffff', stems, g, false);
  instanced(Cap(0.05, 0.1), '#ffffff', heads, g, 0.012);
  instanced(Cyl(0.24, 0.24, 0.3, 14), '#ffffff', pads, g, 0.012, false);
  instanced(Sph(0.28), '#ffffff', rocks, g, 0.015);
}

/** A fish that leaps out of the water now and then, just for life. */
function buildJumper(g: THREE.Object3D) {
  jumper = new THREE.Group();
  part(Sph(0.16), '#ff9a3c', jumper, 0, 0, 0, { s: [0.6, 0.8, 1.5], ol: 0.014 });
  part(Cone(0.13, 0.2, 6), '#ff7a2a', jumper, 0, 0, -0.3, { r: [-Math.PI / 2, 0, 0], s: [0.4, 1, 1], ol: 0.012 });
  jumper.visible = false;
  g.add(jumper);
}

export function buildRiver() {
  const g = new THREE.Group();
  ctx.scene.add(g);
  waterTex = waterTexture();
  waterTex.repeat.set(1, 1);
  const sandO = new THREE.Mesh(ribbon(RIVER_HW + 0.75, 0.008, 4), T('#c9b27a'));
  const sandI = new THREE.Mesh(ribbon(RIVER_HW + 0.5, 0.014, 4), T('#e6d3a0'));
  const water = new THREE.Mesh(ribbon(RIVER_HW, 0.05, 6), new THREE.MeshToonMaterial({ map: waterTex, gradientMap: toonGrad }));
  for (const m of [sandO, sandI, water]) { m.receiveShadow = true; g.add(m); }
  water.userData.type = 'river';
  ctx.pickables.push(water);
  dock(g);
  rowboat(g);
  banks(g);
  buildJumper(g);
}

export function updateRiver(dt: number, t: number) {
  if (!waterTex) return;
  waterTex.offset.x -= dt * 0.05;
  boat.position.y = 0.1 + Math.sin(t * 1.6) * 0.03;
  boat.rotation.z = Math.sin(t * 1.2) * 0.04;
  // the leaping fish
  jumpNext -= dt;
  if (jumpNext <= 0 && !jumper.visible) {
    jumpX = DOCK.x + (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 8);
    jumper.visible = true; jumpT = 0;
    splash3(jumpX - 0.6, riverZ(jumpX), 4);
  }
  if (jumper.visible) {
    jumpT += dt / 0.7;
    const k = Math.min(1, jumpT), zc = riverZ(jumpX);
    jumper.position.set(jumpX - 0.6 + k * 1.2, 0.05 + Math.sin(k * Math.PI) * 0.9, zc);
    jumper.rotation.set(0, Math.PI / 2, 0);
    jumper.rotateX(-(k - 0.5) * 2.2);
    if (k >= 1) { jumper.visible = false; splash3(jumpX + 0.6, zc, 4); jumpNext = 4 + Math.random() * 6; }
  }
}
