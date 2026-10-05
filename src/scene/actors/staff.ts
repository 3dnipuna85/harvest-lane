import * as THREE from 'three';
import { onDuty, timeLeft, type StaffId } from '../../game/staff';
import { lbl } from '../fx/labels';
import { DOCK, PEN } from '../layout';
import { Cap, part } from './smooth';
import { buildPerson, type PersonView } from './person';

/** The animal keeper, pottering about the pen while on duty. (The manager walks the field: see ai.ts.) */

const POSTS: Partial<Record<StaffId, { x: number; z: number; face: number; title: string }>> = {
  keeper: { x: PEN.x0 + 1.7, z: PEN.z0 + 0.8, face: Math.PI / 5, title: 'Keeper' },
  // sitting in the rowboat beside the dock
  fisher: { x: DOCK.x - 2.1, z: DOCK.z1 - 0.35, face: 0.15, title: 'Fisherman' },
};
let views: Partial<Record<StaffId, PersonView>> = {};

export function initStaffActors() {
  views = {
    keeper: buildPerson({ shirt: '#7bbf3a', pants: '#6d5844', hat: '#e7bd6c', band: '#3cc08f', hair: '#c27a3a' }),
    fisher: buildPerson({ shirt: '#ffcf3a', pants: '#2f6fd6', hat: '#ffcf3a', band: '#e2463a', hair: '#3b2416', boots: '#2f4f6e' }),
  };
  for (const k of Object.keys(views) as StaffId[]) { const v = views[k]!; v.root.visible = false; v.root.rotation.y = POSTS[k]!.face; }
  // the fisherman's rod, held out over the water
  const rod = part(Cap(0.025, 1.6), '#9a6438', views.fisher!.arms[0], 0, -0.3, 0.75, { ol: 0.01 });
  rod.rotation.x = 1.9;
  views.fisher!.root.scale.setScalar(1.05);
}

export const fisherPos = () => new THREE.Vector3(POSTS.fisher!.x, 0.6, POSTS.fisher!.z + 1.4);

const tmp = new THREE.Vector3();
const hm = (ms: number) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };

export function updateStaffActors(t: number) {
  for (const k of Object.keys(views) as StaffId[]) {
    const v = views[k]!, on = onDuty(k), p = POSTS[k]!;
    v.root.visible = on;
    if (!on) continue;
    // Standing about: a gentle sway; the manager checks a clipboard, the keeper scatters feed now and then.
    const s = Math.sin(t * 1.6 + (k === 'keeper' ? 2 : 0));
    v.root.position.set(p.x + (k === 'keeper' ? Math.sin(t * 0.4) * 0.6 : 0), k === 'fisher' ? 0.12 + Math.sin(t * 1.6) * 0.03 : 0, p.z);
    if (k === 'fisher') {
      // seated in the boat, rod out, bobbing with the water
      v.legs[0].rotation.x = v.legs[1].rotation.x = -1.4;
      v.arms[0].rotation.set(-1.0 + Math.sin(t * 2.2) * 0.05, 0, 0.15);
      v.arms[1].rotation.set(-0.9, 0, -0.3);
      v.head.rotation.set(0.2, Math.sin(t * 0.5) * 0.2, 0);
      lbl('staff-' + k, `${p.title} · ${hm(timeLeft(k))}`, tmp.set(p.x, 2.4, p.z), 'stafftag');
      continue;
    }
    v.arms[0].rotation.set(k === 'manager' ? -1.2 : -0.4 + Math.max(0, s) * -1.2, 0, 0.15);
    v.arms[1].rotation.set(k === 'manager' ? -1.0 : 0.05 * s, 0, -0.15);
    v.head.rotation.set(k === 'manager' ? 0.25 : 0, Math.sin(t * 0.5) * 0.3, 0);
    v.basket.visible = k === 'keeper';
    lbl('staff-' + k, `${p.title} · ${hm(timeLeft(k))}`, tmp.set(v.root.position.x, 2.7, p.z), 'stafftag');
  }
}
