import * as THREE from 'three';
import { Cap, Cone, Cyl, RB, Sph, Tri, emojiSprite, part } from '../geometry';

/**
 * The rest of Market Town: services along the side streets (bakery, bank, vet and so on) and open-air market stalls.
 * They make the town feel lived in; each one says what it will do as the game grows.
 */

export type ServiceId = 'bakery' | 'bank' | 'vet' | 'post' | 'hardware' | 'cafe' | 'hall';
export interface Service { name: string; soon: string; x: number; z: number; ry: number }

const BACK = Math.PI / 4, LEFT = Math.PI / 2, RIGHT = 0;
export const SERVICES: Record<ServiceId, Service> = {
  bakery: { name: 'Bakery', soon: 'Soon it will buy your wheat, eggs and milk for its cakes.', x: -9.6, z: 2.4, ry: BACK },
  bank: { name: 'Bank', soon: 'Soon it will keep your savings safe and pay you interest.', x: 2.4, z: -9.6, ry: BACK },
  hall: { name: 'Town Hall', soon: 'Soon the mayor will post town jobs and contests here.', x: 6.6, z: -13.6, ry: BACK },
  vet: { name: 'Vet Clinic', soon: 'Soon the vet will treat sick animals.', x: -8.2, z: 8.0, ry: LEFT },
  post: { name: 'Post Office', soon: 'Soon you can send gifts and letters to friends from here.', x: -5.6, z: 13.4, ry: LEFT },
  hardware: { name: 'Hardware', soon: 'Soon it will sell tools and plot upgrades.', x: 8.6, z: -6.4, ry: RIGHT },
  cafe: { name: 'Café', soon: 'Townsfolk meet here for coffee. Soon they will offer you odd jobs.', x: 13.4, z: -2.6, ry: RIGHT },
};
export const SERVICE_IDS = Object.keys(SERVICES) as ServiceId[];
export const serviceDoor = (s: Service, d = 2.2) => ({ x: s.x + Math.sin(s.ry) * d, z: s.z + Math.cos(s.ry) * d });

/** Market stalls in the open square in front, each with a vendor. */
export const STALLS = [
  { x: 4.8, z: 6.0, a: '#e2463a', b: '#ffffff', goods: ['#ff6b5e', '#ffd447', '#ff9a3c'] },
  { x: 8.2, z: 2.8, a: '#3d6fb6', b: '#ffffff', goods: ['#8fd14f', '#5aa83c', '#e8f5a0'] },
  { x: 11.4, z: -0.4, a: '#f39a12', b: '#fff4d0', goods: ['#9b6be8', '#f06aa8', '#ffd447'] },
];

function house(g: THREE.Object3D, w: number, h: number, d: number, wall: string, roof: string, trim: string) {
  part(RB(w, h, d, 0.14), wall, g, 0, h / 2, 0);
  for (const s of [-1, 1]) part(RB(w + 0.3, 0.16, d / 2 + 0.55, 0.07), roof, g, 0, h + 0.62, s * (d / 4 + 0.08), { r: [s * 0.62, 0, 0] });
  const gable = part(Tri(d - 0.05, 0.85, w - 0.05), wall, g, 0, h - 0.02, 0, { ol: false });
  gable.rotation.y = Math.PI / 2;
  part(RB(w + 0.08, 0.12, d + 0.08, 0.05), trim, g, 0, h, 0, { ol: 0.012 });
}

function awning(g: THREE.Object3D, w: number, y: number, z: number, a: string, b: string) {
  const n = 7, sw = w / n;
  for (let i = 0; i < n; i++) part(RB(sw + 0.01, 0.07, 0.9, 0.03), i % 2 ? b : a, g, -w / 2 + sw * (i + 0.5), y, z, { r: [0.42, 0, 0], ol: 0.012 });
}

function door(g: THREE.Object3D, x: number, d: number, col: string) {
  part(RB(0.6, 1.05, 0.08, 0.06), col, g, x, 0.53, d / 2 + 0.02);
  part(Sph(0.04), '#ffd447', g, x + 0.2, 0.55, d / 2 + 0.07, { ol: false });
}
function windows(g: THREE.Object3D, xs: number[], y: number, d: number) {
  for (const x of xs) {
    part(RB(0.55, 0.5, 0.06, 0.06), '#cfeaf7', g, x, y, d / 2 + 0.02);
    part(RB(0.63, 0.08, 0.14, 0.03), '#fffaf0', g, x, y - 0.28, d / 2 + 0.07, { ol: 0.01 });
  }
}
function sign(g: THREE.Object3D, ch: string, y: number, z: number, s = 0.7) {
  const sp = emojiSprite(ch, s); sp.position.set(0, y, z); g.add(sp);
}

const BUILD: Record<ServiceId, (g: THREE.Group) => void> = {
  bakery(g) {
    house(g, 2.6, 1.6, 2.0, '#fbe3c4', '#a0522d', '#ffffff');
    door(g, -0.7, 2.0, '#a0522d'); windows(g, [0.55], 0.8, 2.0);
    awning(g, 2.7, 1.35, 1.2, '#f06aa8', '#ffffff');
    part(RB(0.36, 0.9, 0.36, 0.08), '#b0a294', g, 0.7, 2.2, -0.4);
    part(Cyl(0.3, 0.3, 0.6, 14), '#d9a65c', g, 1.05, 0.32, 1.45, { ol: 0.012 });
    sign(g, '🥐', 2.1, 0.95);
  },
  bank(g) {
    part(RB(3.0, 1.9, 2.2, 0.08), '#e6e1d6', g, 0, 0.95, 0);
    part(RB(3.3, 0.22, 2.5, 0.06), '#c9c1b0', g, 0, 1.98, 0);
    const ped = part(Tri(3.2, 0.7, 0.3), '#e6e1d6', g, 0, 2.08, 1.05);
    ped.rotation.y = 0;
    for (const x of [-1.15, -0.4, 0.4, 1.15]) part(Cyl(0.13, 0.13, 1.7, 14), '#ffffff', g, x, 0.92, 1.3, { ol: 0.012 });
    part(RB(3.2, 0.14, 0.7, 0.04), '#c9c1b0', g, 0, 0.07, 1.35, { ol: 0.012 });
    part(RB(0.7, 1.2, 0.08, 0.05), '#6b4a2a', g, 0, 0.6, 1.12);
    sign(g, '🏦', 2.45, 1.0, 0.6);
  },
  hall(g) {
    house(g, 3.4, 1.9, 2.4, '#f3e6c8', '#4f6fa8', '#ffffff');
    door(g, 0, 2.4, '#4f6fa8'); windows(g, [-1.1, 1.1], 1.0, 2.4);
    // clock tower
    part(RB(1.0, 1.6, 1.0, 0.08), '#f3e6c8', g, 0, 3.0, -0.2);
    part(Cone(0.85, 0.9, 4), '#4f6fa8', g, 0, 4.25, -0.2, { r: [0, Math.PI / 4, 0] });
    const clock = part(Cyl(0.32, 0.32, 0.06, 24), '#ffffff', g, 0, 3.2, 0.31);
    clock.rotation.x = Math.PI / 2;
    part(RB(0.04, 0.22, 0.02, 0.01), '#2b1a10', clock, 0, 0.04, -0.08, { ol: false });
    part(RB(0.16, 0.04, 0.02, 0.01), '#2b1a10', clock, 0.06, 0.04, 0, { ol: false });
    part(Cap(0.03, 1.0), '#8a8a8a', g, 1.35, 2.6, 0.9, { ol: 0.01 });
    const flag = part(RB(0.5, 0.3, 0.02, 0.02), '#e2463a', g, 1.62, 3.0, 0.9, { ol: 0.01 });
    g.userData.flag = flag;
  },
  vet(g) {
    house(g, 2.6, 1.5, 2.0, '#ffffff', '#3cc08f', '#dff5ea');
    door(g, 0.6, 2.0, '#3cc08f'); windows(g, [-0.6], 0.8, 2.0);
    part(RB(0.5, 0.16, 0.06, 0.03), '#e2463a', g, -0.6, 1.32, 1.04, { ol: false });
    part(RB(0.16, 0.5, 0.06, 0.03), '#e2463a', g, -0.6, 1.32, 1.04, { ol: false });
    sign(g, '🐾', 2.0, 0.95, 0.6);
  },
  post(g) {
    house(g, 2.4, 1.5, 1.9, '#9fc8ee', '#c2412f', '#ffffff');
    door(g, -0.5, 1.9, '#c2412f'); windows(g, [0.55], 0.8, 1.9);
    part(Cap(0.05, 0.6), '#3d4a5c', g, 1.4, 0.4, 1.4, { ol: 0.01 });
    part(RB(0.4, 0.45, 0.35, 0.12), '#e2463a', g, 1.4, 0.95, 1.4);
    sign(g, '✉️', 2.0, 0.9, 0.55);
  },
  hardware(g) {
    house(g, 2.6, 1.6, 2.0, '#f2a65a', '#6b6f78', '#fff4e6');
    door(g, 0, 2.0, '#6b4a2a'); windows(g, [-0.85, 0.85], 0.85, 2.0);
    awning(g, 2.7, 1.35, 1.2, '#6b6f78', '#fff4e6');
    part(Cyl(0.24, 0.22, 0.5, 14), '#8a5a36', g, -1.1, 0.25, 1.5, { ol: 0.012 });
    for (const [x, r] of [[-1.15, 0.2], [-1.0, -0.25]] as [number, number][]) part(Cap(0.03, 0.8), '#c98f55', g, x, 0.75, 1.5, { r: [0, 0, r], ol: 0.008 });
    for (const [x, z] of [[1.0, 1.5], [1.3, 1.65]]) part(RB(0.34, 0.3, 0.3, 0.05), '#c98f55', g, x, 0.15, z);
    sign(g, '🔨', 2.1, 0.95, 0.6);
  },
  cafe(g) {
    house(g, 2.6, 1.6, 2.0, '#8fd6c8', '#2f7f74', '#ffffff');
    door(g, 0.75, 2.0, '#2f7f74'); windows(g, [-0.5], 0.85, 2.0);
    awning(g, 2.7, 1.35, 1.2, '#ffcf3a', '#ffffff');
    // a table with a parasol out front
    part(Cap(0.04, 1.3), '#ffffff', g, -0.6, 0.75, 1.9, { ol: 0.008 });
    part(Cone(0.65, 0.3, 10), '#e2463a', g, -0.6, 1.55, 1.9);
    part(Cyl(0.32, 0.32, 0.05, 16), '#ffffff', g, -0.6, 0.55, 1.9, { ol: 0.01 });
    for (const s of [-1, 1]) part(Cyl(0.13, 0.13, 0.35, 12), '#2f7f74', g, -0.6 + s * 0.5, 0.18, 1.9, { ol: 0.01 });
    sign(g, '☕', 2.1, 0.95, 0.6);
  },
};

function stall(g: THREE.Object3D, s: typeof STALLS[number]) {
  const t = new THREE.Group(); t.position.set(s.x, 0, s.z); t.rotation.y = Math.PI / 4; g.add(t);
  for (const x of [-0.75, 0.75]) for (const z of [-0.4, 0.4]) part(Cap(0.04, 1.4), '#8a5a36', t, x, 0.75, z, { ol: 0.008 });
  part(RB(1.7, 0.5, 0.8, 0.05), '#c98f55', t, 0, 0.25, 0.1);
  part(RB(1.8, 0.07, 0.9, 0.03), '#e6b56c', t, 0, 0.52, 0.1, { ol: 0.01 });
  const n = 6, sw = 1.9 / n;
  for (let i = 0; i < n; i++) part(RB(sw + 0.01, 0.06, 1.1, 0.02), i % 2 ? s.b : s.a, t, -0.95 + sw * (i + 0.5), 1.5, 0, { r: [0.15, 0, 0], ol: 0.01 });
  s.goods.forEach((c, j) => {
    part(RB(0.45, 0.14, 0.35, 0.03), '#b07a44', t, -0.55 + j * 0.55, 0.62, 0.2, { ol: 0.008 });
    for (let k = 0; k < 3; k++) part(Sph(0.08), c, t, -0.65 + j * 0.55 + k * 0.1, 0.74, 0.2 + (k % 2) * 0.06, { ol: 0.008, shadow: false });
  });
}

/** The service buildings (each a tappable group) and the market stalls. */
export function buildServices(g: THREE.Object3D, pickables: THREE.Object3D[]) {
  const flags: THREE.Mesh[] = [];
  for (const id of SERVICE_IDS) {
    const s = SERVICES[id], r = new THREE.Group();
    r.position.set(s.x, 0, s.z); r.rotation.y = s.ry;
    r.userData = id === 'vet' ? { type: 'place', k: 'vet' } : { type: 'info', k: id };
    BUILD[id](r);
    if (r.userData.flag) flags.push(r.userData.flag);
    g.add(r); pickables.push(r);
  }
  for (const s of STALLS) stall(g, s);
  return flags;
}
