import * as THREE from 'three';
import { now } from '../../game/clock';
import { sickCount } from '../../game/animals';
import { onDuty } from '../../game/staff';
import { S } from '../../game/state';
import { SHOP_COST, boosted } from '../../game/town';
import { coinHTML, fmt } from '../../ui/format';
import { ctx } from '../context';
import { Cap, Cone, Cyl, RB, Sph, Tri, emojiSprite, part } from '../geometry';
import { T, toonGrad } from '../materials';
import { lbl } from '../fx/labels';
import { buildChicken, buildCow, buildPig, buildSheep } from '../actors/animals';
import { buildPerson, type PersonView } from '../actors/person';
import { bush, tree } from '../world/props';
import { SERVICES, SERVICE_IDS, STALLS, buildServices, serviceDoor } from './services';

/**
 * Market Town: a second little map, drawn in its own THREE.Scene with its own camera. The farm keeps running
 * (and drawing nothing) while the player is here. Three places to visit around a cobbled square: the Animal Market,
 * the General Store and the player's own shop (an empty lot with a "For sale" sign until it is bought).
 */

/** Places with a panel. The vet is one of the side-street services (services.ts). */
export type Place = Building | 'vet';
type Building = 'market' | 'store' | 'shop';

/** Building spots along the back of the square, all facing the camera. */
const SPOT: Record<Building, { x: number; z: number }> = {
  market: { x: -6.6, z: -0.6 },
  store: { x: -3.6, z: -3.6 },
  shop: { x: -0.6, z: -6.6 },
};
const FACE = Math.PI / 4;
const fwd = (p: { x: number; z: number }, d: number) => ({ x: p.x + d * Math.SQRT1_2, z: p.z + d * Math.SQRT1_2 });
/** Where shoppers stand, in front of each door. */
export const DOOR: Record<Building, { x: number; z: number }> = { market: fwd(SPOT.market, 2.2), store: fwd(SPOT.store, 2.2), shop: fwd(SPOT.shop, 2.4) };
const PLAZA = { x: 0.6, z: 0.6, r: 4.4 };
const TW = 60;

export const town = {
  scene: null as unknown as THREE.Scene,
  camera: new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200),
  pickables: [] as THREE.Object3D[],
  built: false,
};

// ---------- ground ----------

function groundTexture() {
  const N = 1024, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!, k = N / TW;
  const P = (wx: number, wz: number): [number, number] => [(wx + TW / 2) * k, (wz + TW / 2) * k];
  x.fillStyle = '#74c043'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 160; i++) {
    const r = (1 + Math.random() * 3) * k, px = Math.random() * N, pz = Math.random() * N;
    const g = x.createRadialGradient(px, pz, 0, px, pz, r);
    const col = ['150,214,84', '96,178,50', '120,200,64'][i % 3];
    g.addColorStop(0, `rgba(${col},.5)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill();
  }
  const STONES = ['#f1e0b4', '#e8d19f', '#f6e8c6', '#dfc590', '#ecd8a8'];
  const stones = (inside: (wx: number, wz: number) => boolean, x0: number, z0: number, x1: number, z1: number) => {
    const s = 0.4;
    for (let wz = z0; wz < z1; wz += s) for (let wx = x0 + (Math.round(wz / s) % 2 ? s / 2 : 0); wx < x1; wx += s) {
      if (!inside(wx, wz)) continue;
      const [a, b] = P(wx + (Math.random() - 0.5) * 0.05, wz + (Math.random() - 0.5) * 0.05);
      x.fillStyle = STONES[Math.floor(Math.random() * STONES.length)];
      x.strokeStyle = '#b8935c'; x.lineWidth = 1.2;
      x.beginPath(); x.ellipse(a, b, s * 0.44 * k, s * 0.4 * k, Math.random() * 3, 0, 7); x.fill(); x.stroke();
    }
  };
  const bed = (pts: [number, number][], w: number) => {
    for (const [col, ww] of [['#b48c55', w + 0.3], ['#dcc28e', w]] as [string, number][]) {
      x.strokeStyle = col; x.lineWidth = ww * k; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); pts.forEach((p, i) => { const [a, b] = P(...p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke();
    }
  };
  // the road in from the farm, and short paths to each door
  const road: [number, number][] = [[-2.5, TW / 2], [-1.2, 8], [PLAZA.x - 0.6, PLAZA.z + 2]];
  bed(road, 2.0);
  for (const p of Object.values(DOOR)) bed([[p.x, p.z], [PLAZA.x, PLAZA.z]], 1.4);
  // side streets out to the services, and a market lane past the stalls
  bed([[PLAZA.x - 3, PLAZA.z + 3], [-6, 8], [-3.4, 13.4]], 1.8);
  bed([[PLAZA.x + 3, PLAZA.z - 3], [10.8, -6.4], [13.4, -0.4]], 1.8);
  bed([[2.4, 9.6], [7, 5], [14, -2]], 2.4);
  for (const id of SERVICE_IDS) { const d = serviceDoor(SERVICES[id]); bed([[d.x, d.z], [PLAZA.x + (d.x - PLAZA.x) * 0.3, PLAZA.z + (d.z - PLAZA.z) * 0.3]], 1.3); }
  // the square
  for (const [col, r] of [['#b48c55', PLAZA.r + 0.2], ['#dcc28e', PLAZA.r]] as [string, number][]) {
    const [a, b] = P(PLAZA.x, PLAZA.z);
    x.fillStyle = col; x.beginPath(); x.arc(a, b, r * k, 0, 7); x.fill();
  }
  stones((wx, wz) => Math.hypot(wx - PLAZA.x, wz - PLAZA.z) < PLAZA.r - 0.2, PLAZA.x - PLAZA.r, PLAZA.z - PLAZA.r, PLAZA.x + PLAZA.r, PLAZA.z + PLAZA.r);
  // flowers in the grass
  const fc = ['#ffffff', '#ffe066', '#ff8fbf', '#c8a6ff', '#ff6b5e'];
  for (let i = 0; i < 260; i++) {
    const px = Math.random() * N, pz = Math.random() * N, wx = px / k - TW / 2, wz = pz / k - TW / 2;
    if (Math.hypot(wx - PLAZA.x, wz - PLAZA.z) < PLAZA.r + 1 || (Math.abs(wx + 1.5) < 2 && wz > 2)) continue;
    x.fillStyle = fc[i % 5];
    for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(px + Math.cos(a * 1.26) * 3, pz + Math.sin(a * 1.26) * 3, 2.6, 0, 7); x.fill(); }
    x.fillStyle = '#f2b318'; x.beginPath(); x.arc(px, pz, 2, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// ---------- buildings ----------

/** Striped awning: alternating slats leaning out over the shop front. */
function awning(g: THREE.Object3D, w: number, y: number, z: number, a: string, b: string) {
  const n = 7, sw = w / n;
  for (let i = 0; i < n; i++) part(RB(sw + 0.01, 0.07, 0.9, 0.03), i % 2 ? b : a, g, -w / 2 + sw * (i + 0.5), y, z, { r: [0.42, 0, 0], ol: 0.012 });
  for (let i = 0; i < n; i++) part(Sph(sw / 2), i % 2 ? b : a, g, -w / 2 + sw * (i + 0.5), y - 0.2, z + 0.42, { s: [1, 0.5, 0.35], ol: 0.01, shadow: false });
}

function house(g: THREE.Object3D, w: number, h: number, d: number, wall: string, roof: string, trim: string) {
  part(RB(w, h, d, 0.14), wall, g, 0, h / 2, 0);
  for (const s of [-1, 1]) part(RB(w + 0.3, 0.16, d / 2 + 0.55, 0.07), roof, g, 0, h + 0.62, s * (d / 4 + 0.08), { r: [s * 0.62, 0, 0] });
  const gable = part(Tri(d - 0.05, 0.85, w - 0.05), wall, g, 0, h - 0.02, 0, { ol: false });
  gable.rotation.y = Math.PI / 2;
  part(RB(w + 0.08, 0.12, d + 0.08, 0.05), trim, g, 0, h, 0, { ol: 0.012 });
}

function market(g: THREE.Group) {
  house(g, 3.0, 1.7, 2.2, '#d9534f', '#8c2f2a', '#fff4e6');
  // big barn doors with white cross braces
  for (const s of [-1, 1]) {
    part(RB(0.62, 1.2, 0.08, 0.06), '#a8423b', g, s * 0.33, 0.62, 1.12);
    const br = part(RB(0.07, 1.3, 0.05, 0.02), '#fff4e6', g, s * 0.33, 0.62, 1.17, { ol: false });
    br.rotation.z = s * 0.45;
  }
  part(RB(1.5, 0.1, 0.12, 0.04), '#fff4e6', g, 0, 1.27, 1.14, { ol: 0.012 });
  for (const s of [-1, 1]) part(RB(0.36, 0.36, 0.06, 0.06), '#cfeaf7', g, s * 1.05, 1.0, 1.12);
  // hay bales and a water trough out front
  for (const [x, z] of [[1.25, 1.55], [1.65, 1.35]]) {
    const h = part(Cyl(0.3, 0.3, 0.5, 16), '#f0cd5f', g, x, 0.3, z); h.rotation.z = Math.PI / 2;
  }
  part(RB(0.8, 0.3, 0.4, 0.1), '#a8774a', g, -1.3, 0.16, 1.5);
  part(RB(0.65, 0.08, 0.28, 0.06), '#7ec6e8', g, -1.3, 0.32, 1.5, { ol: false });
  const sp = emojiSprite('🐄', 0.75); sp.position.set(0, 2.25, 1.0); g.add(sp);
}

function store(g: THREE.Group) {
  house(g, 2.8, 1.6, 2.0, '#f6d27a', '#3f8f4a', '#fffaf0');
  part(RB(0.6, 1.05, 0.08, 0.06), '#7a4a2a', g, 0, 0.53, 1.02);
  part(Sph(0.04), '#ffd447', g, 0.2, 0.55, 1.07, { ol: false });
  for (const s of [-1, 1]) {
    part(RB(0.62, 0.55, 0.06, 0.06), '#cfeaf7', g, s * 0.9, 0.75, 1.02);
    part(RB(0.7, 0.08, 0.14, 0.03), '#fffaf0', g, s * 0.9, 0.44, 1.07, { ol: 0.01 });
  }
  awning(g, 2.9, 1.35, 1.2, '#3f8f4a', '#fffaf0');
  // fertilizer sacks and a seed barrel
  for (const [x, z, r] of [[-1.1, 1.75, 0.2], [-0.75, 1.85, -0.3], [-0.95, 1.7, 0]] as [number, number, number][]) {
    part(Cap(0.2, 0.25), '#efe2c2', g, x, 0.3, z, { s: [1, 1, 0.75], r: [0, r, 0], ol: 0.015 });
    part(Sph(0.08), '#5aa83c', g, x, 0.32, z + 0.15, { s: [1, 1, 0.3], ol: false, shadow: false });
  }
  part(Cyl(0.26, 0.24, 0.55, 16), '#b5763d', g, 1.15, 0.28, 1.7, { ol: 0.015 });
  part(Cyl(0.22, 0.22, 0.05, 16), '#8fbf3a', g, 1.15, 0.57, 1.7, { ol: false });
  const sp = emojiSprite('🌱', 0.7); sp.position.set(0, 2.1, 0.95); g.add(sp);
}

/** The player's own shop: a blue-and-white storefront with a counter of produce out front. */
function shopBuilt(g: THREE.Group) {
  house(g, 2.9, 1.6, 2.0, '#cfe6f7', '#3d6fb6', '#ffffff');
  part(RB(0.6, 1.05, 0.08, 0.06), '#3d6fb6', g, -0.85, 0.53, 1.02);
  part(RB(1.1, 0.6, 0.06, 0.06), '#fff8e0', g, 0.55, 0.85, 1.02);
  awning(g, 3.0, 1.35, 1.2, '#e2463a', '#ffffff');
  // the counter, stacked with crates of goods
  part(RB(2.0, 0.6, 0.55, 0.08), '#c98f55', g, 0.2, 0.3, 1.75);
  part(RB(2.1, 0.08, 0.62, 0.04), '#e6b56c', g, 0.2, 0.63, 1.75, { ol: 0.012 });
  for (const [x, c] of [[-0.45, '#ff6b5e'], [0.2, '#ffd447'], [0.85, '#8fd14f']] as [number, string][]) {
    part(RB(0.5, 0.18, 0.4, 0.04), '#b07a44', g, x, 0.76, 1.75, { ol: 0.01 });
    for (let k = 0; k < 4; k++) part(Sph(0.08), c, g, x - 0.12 + (k % 2) * 0.24, 0.9, 1.68 + Math.floor(k / 2) * 0.15, { ol: 0.01, shadow: false });
  }
  const sp = emojiSprite('🏪', 0.75); sp.position.set(0, 2.15, 0.95); g.add(sp);
}

function shopLot(g: THREE.Group) {
  part(RB(3.0, 0.04, 2.4, 0.3), '#c9a46a', g, 0, 0.02, 0, { ol: false, shadow: false });
  for (const [x, z] of [[-1.2, -0.7], [1.0, -0.4], [0.3, -0.9]]) part(RB(0.38, 0.38, 0.38, 0.06), '#c98f55', g, x, 0.19, z);
  const s = new THREE.Group(); s.position.set(0, 0, 1.0); g.add(s);
  for (const k of [-1, 1]) part(Cap(0.07, 1.1), '#8a5a36', s, k * 0.55, 0.6, 0, { ol: 0.012 });
  part(RB(1.5, 0.75, 0.1, 0.06), '#e6b56c', s, 0, 1.15, 0);
  part(RB(1.3, 0.16, 0.12, 0.04), '#c2412f', s, 0, 1.38, 0.01, { ol: false });
}

function fountain(g: THREE.Object3D) {
  const f = new THREE.Group(); f.position.set(PLAZA.x, 0, PLAZA.z); g.add(f);
  part(Cyl(1.3, 1.4, 0.4, 32), '#d9d2c3', f, 0, 0.2, 0);
  part(Cyl(1.12, 1.12, 0.06, 32), '#58c8f2', f, 0, 0.38, 0, { ol: false });
  part(Cyl(0.18, 0.24, 0.9, 16), '#d9d2c3', f, 0, 0.75, 0);
  part(Cyl(0.55, 0.4, 0.16, 24), '#d9d2c3', f, 0, 1.2, 0);
  part(Cyl(0.45, 0.45, 0.04, 24), '#58c8f2', f, 0, 1.28, 0, { ol: false });
  water = part(Sph(0.16), T('#bfeaff', { transparent: true, opacity: 0.85 }), f, 0, 1.45, 0, { ol: false, shadow: false });
}
let water: THREE.Mesh;

function lamp(g: THREE.Object3D, x: number, z: number) {
  part(Cap(0.06, 1.7), '#3d4a5c', g, x, 0.95, z, { ol: 0.012 });
  part(Sph(0.17), T('#fff2b0', { emissive: '#ffcf4a', emissiveIntensity: 0.5 }), g, x, 1.95, z, { ol: 0.015 });
  part(Cone(0.2, 0.16, 12), '#3d4a5c', g, x, 2.15, z, { ol: 0.012 });
}

function bench(g: THREE.Object3D, x: number, z: number, ry: number) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
  part(RB(1.2, 0.08, 0.38, 0.03), '#b07a44', b, 0, 0.42, 0);
  part(RB(1.2, 0.3, 0.07, 0.03), '#b07a44', b, 0, 0.65, -0.17);
  for (const s of [-1, 1]) part(RB(0.08, 0.42, 0.38, 0.02), '#3d4a5c', b, s * 0.5, 0.21, 0, { ol: 0.01 });
}

/** A small paddock beside the market, with one of each animal for sale. */
interface Display { root: THREE.Group; head: THREE.Group; tail?: THREE.Mesh; ph: number }
let displays: Display[] = [];
function paddock(g: THREE.Object3D) {
  const cx = -4.6, cz = 4.2, hw = 1.7, hd = 1.4;
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [0.25, 0.5]) part(Cap(0.04, L), '#b07a44', g, (x0 + x1) / 2, y, (z0 + z1) / 2, { r: [Math.PI / 2, Math.atan2(x1 - x0, z1 - z0), 0], ol: 0.012 }).rotation.order = 'YXZ';
    const n = Math.max(1, Math.round(L / 0.8));
    for (let i = 0; i <= n; i++) part(Cap(0.06, 0.5), '#9a6438', g, x0 + ((x1 - x0) * i) / n, 0.3, z0 + ((z1 - z0) * i) / n, { ol: 0.012 });
  };
  const c: [number, number][] = [[cx - hw, cz - hd], [cx + hw, cz - hd], [cx + hw, cz + hd], [cx - hw, cz + hd]];
  for (let i = 0; i < 4; i++) rail(...c[i], ...c[(i + 1) % 4]);
  const put = (v: { g: THREE.Group; head: THREE.Group; tail?: THREE.Mesh }, x: number, z: number, ry: number) => {
    g.add(v.g); v.g.position.set(x, 0, z); v.g.rotation.y = ry;
    displays.push({ root: v.g, head: v.head, tail: v.tail, ph: Math.random() * 6 });
  };
  put(buildCow(), cx - 0.7, cz - 0.5, 0.9);
  put(buildPig(), cx + 0.8, cz - 0.6, 0.3);
  put(buildSheep(), cx + 0.5, cz + 0.6, 1.4);
  put(buildChicken(), cx - 0.9, cz + 0.8, 0.6);
  put(buildChicken(), cx - 0.4, cz + 0.9, 2.2);
}

// ---------- townsfolk ----------

interface Walker { v: PersonView; x: number; z: number; tx: number; tz: number; wait: number; ph: number; face: number }
let folk: Walker[] = [];
const SHIRTS = ['#f06aa8', '#4aa3e8', '#ff9a3c', '#9b6be8', '#3cc08f', '#e2463a', '#ffcf3a', '#8fd6c8'];
const PANTS = ['#5a4a8a', '#6d5844', '#34466e', '#8a5a36', '#4a4a4a', '#2f6fd6'];
const HATS = ['#fff4e0', '#e7bd6c', '#ffffff', '#ffcf3a', '#e9b864', '#f06aa8', '#3d6fb6'];
const HAIR = ['#3b2416', '#e0b060', '#1f1a17', '#c27a3a', '#6b3d22', '#9a9a9a'];
/** Sixteen townsfolk; every fourth one is a child. */
const OUTFITS = Array.from({ length: 16 }, (_, i) => ({
  shirt: SHIRTS[i % SHIRTS.length], pants: PANTS[(i * 3) % PANTS.length], hat: HATS[(i * 5) % HATS.length],
  band: SHIRTS[(i + 3) % SHIRTS.length], hair: HAIR[(i * 7) % HAIR.length], kid: i % 4 === 3,
}));
let vendors: PersonView[] = [];
let flags: THREE.Mesh[] = [];
let keeper: PersonView;

function pickSpot(w: Walker) {
  const r = Math.random();
  // with the shop open, a good share of townsfolk drop by to buy something
  const shopOpen = S.town.shop && onDuty('shopkeeper');
  const svc = SERVICES[SERVICE_IDS[Math.floor(Math.random() * SERVICE_IDS.length)]];
  const st = STALLS[Math.floor(Math.random() * STALLS.length)];
  const p = shopOpen && r < 0.25 ? DOOR.shop : r < 0.35 ? DOOR.market : r < 0.42 ? DOOR.store
    : r < 0.65 ? serviceDoor(svc, 2.6) : r < 0.78 ? { x: st.x + 0.9, z: st.z + 0.9 } : null;
  if (p) { w.tx = p.x + (Math.random() - 0.5) * 1.2; w.tz = p.z + (Math.random() - 0.5) * 0.6; return; }
  const a = Math.random() * Math.PI * 2, d = 1.8 + Math.random() * (PLAZA.r - 2.2);
  w.tx = PLAZA.x + Math.cos(a) * d; w.tz = PLAZA.z + Math.sin(a) * d;
}

// ---------- build ----------

let shopRoot: THREE.Group, shopState: boolean | null = null, shopPop = 0;
const roots: Partial<Record<Building, THREE.Group>> = {};

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fbf5f', 0.62));
  const sun = new THREE.DirectionalLight('#fff1d6', 0.72);
  sun.position.set(-9, 20, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.target.position.set(2, 0, 0); scene.add(sun.target);
  sun.position.set(-7, 20, 14);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun);
}

/** Build the town the first time the player drives there. */
export function buildTown() {
  if (town.built) return;
  town.built = true;
  const scene = (town.scene = new THREE.Scene());
  lights(scene);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(TW, TW), new THREE.MeshToonMaterial({ map: groundTexture(), gradientMap: toonGrad }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), T('#74c043'));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.02; scene.add(far);
  const g = new THREE.Group(); scene.add(g);
  for (const k of Object.keys(SPOT) as Building[]) {
    const r = new THREE.Group();
    r.position.set(SPOT[k].x, 0, SPOT[k].z); r.rotation.y = FACE;
    r.userData = { type: 'place', k };
    g.add(r); town.pickables.push(r); roots[k] = r;
  }
  market(roots.market!); store(roots.store!);
  shopRoot = roots.shop!;
  fountain(g);
  paddock(g);
  flags = buildServices(g, town.pickables);
  for (const [x, z] of [[PLAZA.x + 3.4, PLAZA.z - 2.6], [PLAZA.x - 2.6, PLAZA.z + 3.4], [PLAZA.x + 3.9, PLAZA.z + 2.2], [PLAZA.x - 3.6, PLAZA.z - 2.0],
    [-6.6, 5.6], [-2.6, 11], [6.4, -3.6], [11.6, -4.2], [3.6, 9.4], [9.6, 4.4]]) lamp(g, x, z);
  bench(g, PLAZA.x + 2.4, PLAZA.z + 2.9, -Math.PI * 0.75);
  bench(g, PLAZA.x + 3.6, PLAZA.z - 0.4, -Math.PI / 2);
  // trees and bushes framing the square
  for (const [x, z, s, f] of [[-12, -4, 1.2, ''], [-9, -8, 1.3, '#ff5b5b'], [-5, -10.5, 1.2, ''], [-1, -12.5, 1.25, '#ff8a3d'], [3, -14.5, 1.2, ''],
    [10.5, -11, 1.3, ''], [12.6, -8.4, 1.2, '#ff5b5b'], [16.5, -5, 1.3, ''], [16.6, 2, 1.2, '#ff8a3d'], [14.6, 5.4, 1.3, ''], [9.4, 9.4, 1.2, '#ff5b5b'],
    [5.4, 11.6, 1.3, ''], [1.6, 13, 1.2, ''], [-9.4, 12.2, 1.2, '#ff8a3d'], [-12.2, 6.2, 1.3, ''], [-13.4, 1, 1.2, ''], [-8.6, 17, 1.3, '#ff5b5b'], [0.4, 17.4, 1.2, ''],
    [4.8, -5.2, 1.0, '']] as [number, number, number, string][]) tree(g, x, z, s, f || undefined);
  for (const [x, z, s] of [[-8.6, -1.4, 0.9], [-5.6, -4.4, 0.9], [-2.6, -7.4, 0.9], [1.4, -6.4, 0.85], [4.6, 1.0, 0.9], [0.8, 5.6, 0.8], [-2.8, 6.6, 0.9]]) bush(g, x, z, s);
  // a signpost by the road home
  part(Cap(0.07, 1.1), '#9a6438', g, -3.4, 0.6, 9.2, { ol: 0.012 });
  part(RB(1.1, 0.34, 0.08, 0.05), '#e6b56c', g, -3.25, 1.05, 9.2, { r: [0, -0.7, 0] });
  // townsfolk
  folk = OUTFITS.map((o, i) => {
    const v = buildPerson(o);
    g.add(v.root);
    v.root.scale.setScalar(o.kid ? 0.8 : 1.1);
    const a = (i / OUTFITS.length) * Math.PI * 2, d = 2.2 + (i % 3) * 2.5;
    const w: Walker = { v, x: PLAZA.x + Math.cos(a) * d, z: PLAZA.z + Math.sin(a) * d, tx: 0, tz: 0, wait: Math.random() * 2, ph: Math.random() * 6, face: 0 };
    pickSpot(w);
    return w;
  });
  // a vendor behind every stall
  vendors = STALLS.map((st, i) => {
    const v = buildPerson({ shirt: st.a, pants: '#6d5844', hat: st.b, band: st.a, hair: HAIR[i * 2] });
    g.add(v.root);
    v.root.position.set(st.x - 0.55, 0, st.z - 0.55); v.root.rotation.y = FACE;
    return v;
  });
  keeper = buildPerson({ shirt: '#ffffff', pants: '#3d6fb6', hat: '#e2463a', band: '#ffffff', hair: '#2e2018' });
  g.add(keeper.root);
  keeper.root.visible = false;
  syncShop();
  fitTown();
}

/** Swap the empty lot for a shop once it is bought. */
function syncShop() {
  if (shopState === S.town.shop) return;
  const was = shopState;
  shopState = S.town.shop;
  shopRoot.clear();
  const inner = new THREE.Group();
  shopRoot.add(inner);
  if (S.town.shop) shopBuilt(inner); else shopLot(inner);
  if (was === false && S.town.shop) shopPop = 0.6;
}

// ---------- camera ----------

/** Fit, pan and zoom for the town view: the same isometric angle as the farm. */
const cam = { cx: 0, cy: 0, sx: 1, sy: 1, Z: 1, px: 0, py: 0, hw: 10, hh: 10 };
export const townView = cam;
function fitTown() {
  const c = town.camera;
  c.position.set(24, 21, 24); c.lookAt(0, 0, 0); c.updateMatrixWorld(true);
  const inv = c.matrixWorldInverse, a = [1e9, -1e9, 1e9, -1e9];
  const pts: [number, number, number][] = [[-7, 0, 5.8], [-2.8, 0, 6.2], [5.2, 0, 5.2], [5.6, 0, -2], [1.6, 0, -8.2], [-8.6, 0, 1.6]];
  for (const k of Object.values(SPOT)) pts.push([k.x - 1, 3.2, k.z - 1]);
  for (const k of SERVICE_IDS) { const v = SERVICES[k]; pts.push([v.x, 3.4, v.z], [v.x + 2, 0, v.z + 2]); }
  for (const p of pts) {
    const v = new THREE.Vector3(...p).applyMatrix4(inv);
    a[0] = Math.min(a[0], v.x); a[1] = Math.max(a[1], v.x); a[2] = Math.min(a[2], v.y); a[3] = Math.max(a[3], v.y);
  }
  Object.assign(cam, { cx: (a[0] + a[1]) / 2, cy: (a[2] + a[3]) / 2, sx: a[1] - a[0], sy: a[3] - a[2] });
  // tall phone screens fit the town by its width, which leaves it tiny; start closer in (drag to look around)
  cam.Z = ctx.CW < ctx.CH ? 2.0 : 1.15;
  applyTownCam();
}

export function applyTownCam() {
  const c = town.camera, asp = ctx.CW / ctx.CH;
  let hw = cam.sx / 2 / cam.Z, hh = cam.sy / 2 / cam.Z;
  if (hw / hh < asp) hw = hh * asp; else hh = hw / asp;
  cam.hw = hw; cam.hh = hh;
  // pan only as far as the fitted area reaches beyond the view
  const lx = Math.max(0, cam.sx / 2 - hw + 1.5), ly = Math.max(0, cam.sy / 2 - hh + 1.5);
  cam.px = Math.max(-lx, Math.min(lx, cam.px)); cam.py = Math.max(-ly, Math.min(ly, cam.py));
  const cx = cam.cx + cam.px, cy = cam.cy + cam.py;
  c.left = cx - hw; c.right = cx + hw; c.top = cy + hh; c.bottom = cy - hh;
  c.updateProjectionMatrix();
}
export function setTownZoom(z: number) { cam.Z = Math.max(1, Math.min(2.4, z)); applyTownCam(); }

// ---------- per frame ----------

const tmp = new THREE.Vector3();

export function updateTown(dt: number, t: number) {
  syncShop();
  if (shopPop > 0) { shopPop = Math.max(0, shopPop - dt); const k = shopPop / 0.6; shopRoot.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.15); }
  water.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
  water.position.y = 1.45 + Math.abs(Math.sin(t * 3)) * 0.12;
  for (const d of displays) {
    d.head.rotation.x = 0.3 + Math.sin(t * 1.4 + d.ph) * 0.25;
    if (d.tail) d.tail.rotation.z = Math.sin(t * 3 + d.ph) * 0.4;
  }
  for (const w of folk) {
    const dx = w.tx - w.x, dz = w.tz - w.z, dist = Math.hypot(dx, dz), v = w.v;
    const walking = dist > 0.05 && w.wait <= 0;
    if (w.wait > 0) w.wait -= dt;
    else if (dist > 0.05) {
      const s = Math.min(dist, 1.3 * dt);
      w.x += (dx / dist) * s; w.z += (dz / dist) * s; w.face = Math.atan2(dx, dz); w.ph += dt * 9;
    } else { w.wait = 1.5 + Math.random() * 3.5; pickSpot(w); }
    const sw = walking ? Math.sin(w.ph) * 0.7 : 0;
    v.root.position.set(w.x, walking ? Math.abs(Math.sin(w.ph)) * 0.07 : 0, w.z);
    let dr = w.face - v.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); v.root.rotation.y += dr * 0.2;
    v.legs[0].rotation.x = sw; v.legs[1].rotation.x = -sw;
    v.arms[0].rotation.set(-sw * 0.8, 0, 0.12); v.arms[1].rotation.set(sw * 0.8, 0, -0.12);
    v.head.rotation.set(0, walking ? 0 : Math.sin(t * 0.7 + w.ph) * 0.3, 0);
  }
  vendors.forEach((v, i) => {
    v.arms[0].rotation.set(-0.4 + Math.max(0, Math.sin(t * 1.8 + i * 2)) * -1.4, 0, 0.15);
    v.head.rotation.set(0, Math.sin(t * 0.5 + i) * 0.4, 0);
  });
  for (const f of flags) f.rotation.y = Math.sin(t * 3) * 0.25;
  // the shopkeeper, behind the counter while on duty
  const on = S.town.shop && onDuty('shopkeeper');
  keeper.root.visible = on;
  if (on) {
    const p = fwd(SPOT.shop, 1.25);
    keeper.root.position.set(p.x - 0.2, 0, p.z + 0.2);
    keeper.root.rotation.y = FACE;
    keeper.arms[0].rotation.set(-0.5 + Math.max(0, Math.sin(t * 2)) * -0.9, 0, 0.15);
    keeper.arms[1].rotation.set(-0.4, 0, -0.15);
    keeper.head.rotation.set(0, Math.sin(t * 0.6) * 0.3, 0);
  }
  // signs over each place
  const at = (k: Building, h: number) => { const p = SPOT[k]; return tmp.set(p.x + 0.6, h, p.z + 0.6); };
  lbl('town-market', '<b>Animal Market</b><span>Animals · bigger pens</span>', at('market', 3.1), 'townsign p-market');
  lbl('town-store', `<b>General Store</b><span>${boosted() ? '🌱 Fertilizer on · ' + Math.ceil((S.boost - now()) / 60000) + 'm' : 'Fertilizer'}</span>`, at('store', 3.0), 'townsign p-store');
  lbl('town-shop', S.town.shop
    ? `<b>Your Shop</b><span>${on ? 'Open · ' + fmt(S.stats.shop || 0) + ' earned' : 'Closed · hire a shopkeeper'}</span>`
    : `<b>Shop for sale</b><span class="r">${coinHTML}${fmt(SHOP_COST)}</span>`, at('shop', S.town.shop ? 3.0 : 2.0), 'townsign p-shop' + (S.town.shop ? '' : ' forsale'));
  for (const id of SERVICE_IDS) {
    const v = SERVICES[id], d = serviceDoor(v, 0.4);
    if (id === 'vet') {
      const n = sickCount();
      lbl('town-vet', `<b>Vet Clinic</b>${n ? `<span>🤒 ${n} sick animal${n > 1 ? 's' : ''}</span>` : ''}`, tmp.set(d.x, 2.95, d.z), 'townsign p-vet' + (n ? ' forsale' : ''));
    } else lbl('town-' + id, `<b>${v.name}</b>`, tmp.set(d.x, id === 'hall' ? 4.9 : 2.95, d.z), 'townsign small p-info-' + id);
  }
  lbl('town-home', '<b>← Farm</b>', tmp.set(-3.25, 1.6, 9.2), 'townsign home p-farm');
}

/** World point to page coordinates in the town view. */
export const shopPos = () => { const p = fwd(SPOT.shop, 1.4); return new THREE.Vector3(p.x, 1.8, p.z); };
