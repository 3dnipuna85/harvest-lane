import * as THREE from 'three';
import { BUILDING_IDS, type BuildingId } from '../../data/buildings';
import { on } from '../../game/events';
import { S } from '../../game/state';
import { ctx } from '../context';
import { sparkle } from '../fx/particles';
import { Cone, Cyl, RB, Sph, part } from '../geometry';
import { BX, BZ, PEN } from '../layout';
import { T } from '../materials';
import { HOUSE } from './decor';

/** Building upgrades (data/buildings.ts) on the farm: each level adds its own set of parts, kept from then on. */

function silo(g: THREE.Group, x: number, z: number, h: number, roof: string) {
  part(Cyl(0.62, 0.62, h, 22), '#dfe3e6', g, x, h / 2, z);
  for (let k = 1; k < 4; k++) part(Cyl(0.635, 0.635, 0.06, 22), '#b9c0c6', g, x, (h * k) / 4, z, { ol: false });
  part(Sph(0.64), roof, g, x, h, z, { s: [1, 0.6, 1] });
  part(RB(0.08, h, 0.12, 0.03), '#8f979e', g, x + 0.62, h / 2, z + 0.2, { ol: 0.01 });
}

const MAKE: Record<BuildingId, ((g: THREE.Group) => void)[]> = {
  barn: [
    g => silo(g, BX[0] - 1.9, BZ - 1.9, 3.0, '#d9483a'),
    g => silo(g, BX[0] - 3.15, BZ - 1.9, 3.6, '#d9483a'),
    g => {
      // a cold store behind the barn
      const x = BX[0] + 0.3, z = BZ - 1.95;
      part(RB(2.2, 1.3, 1.3, 0.1), '#eef2f4', g, x, 0.65, z);
      part(RB(2.4, 0.16, 1.5, 0.06), '#3a7dc4', g, x, 1.38, z);
      part(RB(0.6, 0.9, 0.08, 0.05), '#9fb4c4', g, x - 0.5, 0.47, z + 0.67);
      part(RB(0.3, 0.3, 0.3, 0.05), '#8f979e', g, x + 0.75, 1.6, z, { ol: 0.012 });
    },
  ],
  pens: [
    g => {
      // a lean-to shelter roof along the back of the pen
      const z0 = PEN.z0 + 0.35, z1 = PEN.z0 + 1.55, x0 = PEN.x0 + 0.4, x1 = PEN.x1 - 0.4;
      for (const x of [x0, (x0 + x1) / 2, x1]) for (const [z, h] of [[z0, 1.9], [z1, 1.55]]) part(Cyl(0.06, 0.07, h, 8), '#8a5530', g, x, h / 2, z, { ol: 0.012 });
      part(RB(x1 - x0 + 0.5, 0.1, z1 - z0 + 0.5, 0.04), '#b8703c', g, (x0 + x1) / 2, 1.78, (z0 + z1) / 2, { r: [0.29, 0, 0] });
    },
    g => {
      // water troughs and straw
      for (const x of [PEN.x0 + 1.0, PEN.x1 - 1.1]) {
        part(RB(1.0, 0.32, 0.4, 0.06), '#8a5530', g, x, 0.18, PEN.z1 - 0.45);
        part(RB(0.86, 0.04, 0.28, 0.02), T('#7fd0f0', { emissive: '#3aa0d0', emissiveIntensity: 0.25 }), g, x, 0.33, PEN.z1 - 0.45, { ol: false });
      }
      for (const [x, z] of [[PEN.x0 + 0.9, PEN.z0 + 2.2], [PEN.x1 - 0.8, PEN.z0 + 2.5]]) part(Sph(0.42), '#ecd27a', g, x, 0.05, z, { s: [1.4, 0.3, 1.1], ol: false });
    },
    g => {
      // an automatic feeder: a hopper on legs with a chute into the pen
      const x = PEN.x0 - 0.75, z = PEN.z0 + 0.6;
      for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) part(Cyl(0.04, 0.04, 1.2, 6), '#5b6066', g, x + dx, 0.6, z + dz, { ol: 0.01 });
      part(Cyl(0.5, 0.5, 0.9, 16), '#7fae4a', g, x, 1.65, z);
      part(Cone(0.5, 0.5, 16), '#7fae4a', g, x, 1.0, z, { r: [Math.PI, 0, 0] });
      part(Cone(0.52, 0.3, 16), '#5d7f34', g, x, 2.25, z);
      part(Cyl(0.07, 0.07, 1.3, 8), '#b9c0c6', g, x + 0.6, 0.85, z + 0.2, { r: [0, 0, -1.1], ol: 0.01 });
      part(RB(0.9, 0.2, 0.35, 0.05), '#8a5530', g, x + 1.45, 0.12, z + 0.2);
    },
  ],
  house: [
    g => {
      // a covered porch with a bench
      const z = HOUSE.z + 1.75;
      for (const x of [HOUSE.x - 1.5, HOUSE.x + 1.5]) part(Cyl(0.06, 0.06, 1.5, 8), '#fffaf0', g, x, 0.75, z + 0.35, { ol: 0.012 });
      part(RB(3.4, 0.1, 1.0, 0.04), '#b8352a', g, HOUSE.x, 1.55, z, { r: [0.22, 0, 0] });
      part(RB(3.2, 0.08, 0.95, 0.03), '#c9a06a', g, HOUSE.x, 0.06, z, { ol: false });
      part(RB(0.9, 0.08, 0.3, 0.03), '#8a5530', g, HOUSE.x + 0.8, 0.42, z, { ol: 0.01 });
      part(RB(0.9, 0.3, 0.06, 0.03), '#8a5530', g, HOUSE.x + 0.8, 0.62, z - 0.14, { ol: 0.01 });
    },
    g => {
      // a new wing at the back
      const x = HOUSE.x + 0.5, z = HOUSE.z - 2.0;
      part(RB(2.2, 1.45, 1.6, 0.12), '#f4e4c1', g, x, 0.72, z);
      part(RB(2.4, 0.16, 1.8, 0.06), '#d9483a', g, x, 1.5, z);
      part(RB(0.5, 0.5, 0.08, 0.05), '#9fd8f0', g, x - 0.5, 0.85, z - 0.82, { ol: 0.012 });
      part(RB(0.5, 0.5, 0.08, 0.05), '#9fd8f0', g, x + 0.5, 0.85, z - 0.82, { ol: 0.012 });
    },
    g => {
      // solar panels on the wing and a little greenhouse
      const x = HOUSE.x + 0.5, z = HOUSE.z - 2.0;
      for (const dx of [-0.55, 0.55]) part(RB(0.95, 0.06, 1.3, 0.02), T('#2a4a8a', { emissive: '#1a3a7a', emissiveIntensity: 0.3 }), g, x + dx, 1.72, z, { r: [0.35, 0, 0], ol: 0.01 });
      const gx = HOUSE.x + 3.0, gz = HOUSE.z - 0.4;
      const glass = T('#c8ecf4', { transparent: true, opacity: 0.55 });
      part(RB(1.3, 0.9, 1.7, 0.05), glass, g, gx, 0.45, gz, { ol: 0.012 });
      part(RB(0.75, 0.06, 1.75, 0.02), glass, g, gx - 0.33, 1.08, gz, { r: [0, 0, 0.7], ol: 0.01 });
      part(RB(0.75, 0.06, 1.75, 0.02), glass, g, gx + 0.33, 1.08, gz, { r: [0, 0, -0.7], ol: 0.01 });
      for (const dz of [-0.5, 0, 0.5]) part(Sph(0.16), '#4fae3d', g, gx, 0.3, gz + dz, { ol: false, shadow: false });
    },
  ],
};

const groups: { k: BuildingId; lvl: number; g: THREE.Group }[] = [];
const SPOT: Record<BuildingId, () => [number, number]> = {
  barn: () => [BX[0] - 1.5, BZ - 1.5],
  pens: () => [(PEN.x0 + PEN.x1) / 2, PEN.z0 + 1],
  house: () => [HOUSE.x, HOUSE.z],
};

let bound = false;
export function buildUpgrades() {
  groups.length = 0;
  for (const k of BUILDING_IDS) MAKE[k].forEach((make, i) => {
    const g = new THREE.Group();
    g.visible = false;
    make(g);
    ctx.scene.add(g);
    groups.push({ k, lvl: i + 1, g });
  });
  if (bound) return;
  bound = true;
  on('buildingUp', ({ k }) => {
    const [x, z] = SPOT[k]();
    for (let n = 0; n < 10; n++) setTimeout(() => sparkle(x - 1.5 + Math.random() * 3, z - 1 + Math.random() * 2), n * 90);
  });
}

export function updateUpgrades() {
  for (const b of groups) b.g.visible = (S.build?.[b.k] || 0) >= b.lvl;
}
