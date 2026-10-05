import * as THREE from 'three';
import { S } from '../../game/state';
import { ctx } from '../context';
import { Cap, Cyl, RB, Sph, part } from '../geometry';
import { CARTP, DOCK, GW, PEN, ROADZ } from '../layout';
import { T, olMat, toonGrad } from '../materials';
import { groundTexture } from './ground';

function tree(g: THREE.Object3D, x: number, z: number, s: number, fruit?: string) {
  const t = new THREE.Group();
  t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t);
  part(Cap(0.18, 0.7), '#9a6438', t, 0, 0.5, 0);
  part(Sph(0.85), '#4fb03c', t, 0, 1.75, 0, { s: [1, 0.9, 1] });
  part(Sph(0.62), '#62c44a', t, -0.55, 1.45, 0.25);
  part(Sph(0.6), '#5abb43', t, 0.55, 1.5, 0.15);
  part(Sph(0.5), '#74d356', t, 0.15, 2.25, 0.2);
  if (fruit) for (const [a, b, c] of [[0.45, 1.9, 0.6], [-0.5, 1.6, 0.7], [0.1, 1.3, 0.85], [-0.2, 2.2, 0.55]]) part(Sph(0.13), fruit, t, a, b, c, { ol: 0.02 });
  return t;
}

function bush(g: THREE.Object3D, x: number, z: number, s: number) {
  const b = new THREE.Group();
  b.position.set(x, 0, z); b.scale.setScalar(s); g.add(b);
  part(Sph(0.42), '#4fae3d', b, 0, 0.3, 0);
  part(Sph(0.32), '#5fbf47', b, 0.35, 0.24, 0.1);
  part(Sph(0.3), '#58b843', b, -0.33, 0.22, 0.12);
  if (Math.random() < 0.5) for (const [a, c] of [[0.1, 0.38], [-0.2, 0.3], [0.3, 0.2]]) part(Sph(0.06), '#ff8fb7', b, a, 0.55, c, { ol: 0.015, shadow: false });
}

/** A fence along a polyline. Posts are instanced; rails are one capsule per segment and height. */
function fenceLine(g: THREE.Object3D, pts: [number, number][], step: number, post = '#c98f55', rail = '#dba56a') {
  const posts: [number, number][] = [], rails: { x: number; z: number; L: number; a: number }[] = [];
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step));
    for (let i = 0; i <= n; i++) posts.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
    rails.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, L, a: Math.atan2(x1 - x0, z1 - z0) });
  }
  const postG = Cap(0.09, 0.55);
  const pm = new THREE.InstancedMesh(postG, T(post), posts.length), po = new THREE.InstancedMesh(postG, olMat(0.025), posts.length);
  const d = new THREE.Object3D();
  posts.forEach(([x, z], i) => { d.position.set(x, 0.38, z); d.rotation.set(0, 0, 0); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); po.setMatrixAt(i, d.matrix); });
  pm.castShadow = true;
  g.add(pm, po);
  for (const r of rails) for (const y of [0.5, 0.27]) {
    const m = part(Cap(0.05, r.L), rail, g, r.x, y, r.z, { ol: 0.02 });
    m.rotation.set(Math.PI / 2, 0, 0); m.rotation.y = r.a; m.rotation.order = 'YXZ';
  }
}

export function buildWorld() {
  const g = new THREE.Group();
  ctx.scene.add(g);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GW), new THREE.MeshToonMaterial({ map: groundTexture(), gradientMap: toonGrad }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), T('#74c043'));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.02; g.add(far);
  // white picket farm fence (gaps where the road leaves)
  // a gate gap at the dock path to the river
  fenceLine(g, [[-13, ROADZ + 1.6], [-13, 10.6], [DOCK.x - 0.75, 10.6]], 0.75, '#fffaf0', '#f3ead8');
  fenceLine(g, [[DOCK.x + 0.75, 10.6], [13, 10.6], [13, ROADZ + 1.6]], 0.75, '#fffaf0', '#f3ead8');
  fenceLine(g, [[-13, ROADZ - 1.6], [-13, -9.4], [13, -9.4], [13, ROADZ - 1.6]], 0.75, '#fffaf0', '#f3ead8');
  // animal pen with a trough
  fenceLine(g, [[PEN.x0, PEN.z0], [PEN.x1, PEN.z0], [PEN.x1, PEN.z1], [PEN.x0, PEN.z1], [PEN.x0, PEN.z0]], 0.85);
  part(RB(0.9, 0.35, 0.5, 0.12), '#a8774a', g, PEN.x0 + 0.8, 0.2, PEN.z1 - 0.6);
  part(RB(0.75, 0.12, 0.36, 0.08), '#7ec6e8', g, PEN.x0 + 0.8, 0.4, PEN.z1 - 0.6, { ol: false });
  // trees, bushes, hay
  tree(g, -6.2, -9.2, 0.95, '#ff5b5b'); tree(g, 3.2, -9.4, 1.05, '#ff5b5b'); tree(g, 9.3, -8.6, 1.1);
  tree(g, 11.6, 7.4, 1.3, '#ff5b5b'); tree(g, -12, 10, 1.2); tree(g, 4.5, 17.4, 1.3); tree(g, -4, 17.6, 1.2);
  tree(g, 15, 0, 1.4); tree(g, -15.5, 4, 1.4); tree(g, 14.5, -6, 1.3, '#ff8a3d'); tree(g, -15, -7, 1.3); tree(g, 9.5, 17.2, 1.3); tree(g, -9.5, 17.4, 1.3, '#ff5b5b'); tree(g, 0.5, 18.2, 1.2, '#ff8a3d'); tree(g, 14, 17.8, 1.3);
  for (const [x, z, s] of [[9.2, 9.8, 1], [10.3, 9.6, 0.8], [-6, 10, 0.9], [2.2, 10.1, 0.85], [-12.2, 6.5, 0.9], [12.2, -1.7, 0.9], [-3, -9, 0.8], [7, -9, 0.85]]) bush(g, x, z, s);
  for (const [x, z] of [[9.4, 5.2], [10.1, 5.9]]) {
    const h = part(Cyl(0.38, 0.38, 0.6, 18), '#f0cd5f', g, x, 0.38, z);
    h.rotation.z = Math.PI / 2;
    part(Cyl(0.39, 0.39, 0.08, 18), '#d9a843', h, 0, 0.15, 0, { ol: false });
  }
  // signpost
  part(Cap(0.07, 0.9), '#9a6438', g, -1.6, 0.55, -2.3);
}

let cartG: THREE.Group;

/** The market cart by the road, where sellers stand. */
export function buildCart() {
  const g = new THREE.Group();
  g.position.set(CARTP.x, 0, CARTP.z);
  part(RB(1.7, 0.55, 0.95, 0.12), '#b9773f', g, 0, 0.6, 0);
  for (const sx of [-0.55, 0.55]) {
    const w = part(Cyl(0.3, 0.3, 0.12, 18), '#6b4429', g, sx, 0.3, 0.52);
    w.rotation.x = Math.PI / 2;
    part(Cyl(0.1, 0.1, 0.14, 12), '#f0cd5f', w, 0, 0, 0, { ol: false });
  }
  for (const sx of [-0.78, 0.78]) part(Cap(0.05, 1.1), '#8a5a36', g, sx, 1.35, 0);
  for (let k = 0; k < 5; k++) part(RB(0.36, 0.12, 1.15, 0.05), k % 2 ? '#fff7ea' : '#e2463a', g, -0.72 + k * 0.36, 1.98, 0, { ol: 0.02 });
  for (const [x, c] of [[-0.5, '#f2c94c'], [0, '#ff8a3d'], [0.45, '#e64a3b'], [-0.25, '#7cc94f'], [0.22, '#ffb84d']] as [number, string][]) {
    part(Sph(0.16), c, g, x, 0.98, ((x * 3) % 2) * 0.12, { ol: 0.02 });
  }
  g.userData.type = 'cart';
  ctx.scene.add(g);
  ctx.pickables.push(g);
  cartG = g;
}

export function updateCart() {
  cartG.visible = S.level >= 3 || S.sellers > 0;
}
