import * as THREE from 'three';
import { onDuty, timeLeft, type StaffId } from '../../game/staff';
import { lbl } from '../fx/labels';
import { PEN } from '../layout';
import { buildPerson, type PersonView } from './person';

/** The paid staff, standing at their posts while on duty: the manager at the top of the field, the keeper in the pen. */

const POSTS: Record<StaffId, { x: number; z: number; face: number; title: string }> = {
  manager: { x: 3.4, z: -2.55, face: 0.35, title: 'Manager' },
  keeper: { x: PEN.x0 + 1.7, z: PEN.z0 + 0.8, face: Math.PI / 5, title: 'Keeper' },
};
let views: Partial<Record<StaffId, PersonView>> = {};

export function initStaffActors() {
  views = {
    manager: buildPerson({ shirt: '#ffffff', pants: '#34466e', hat: '#34466e', band: '#c2412f', hair: '#2e2018', boots: '#2b2b2b' }),
    keeper: buildPerson({ shirt: '#7bbf3a', pants: '#6d5844', hat: '#e7bd6c', band: '#3cc08f', hair: '#c27a3a' }),
  };
  for (const k of Object.keys(views) as StaffId[]) { const v = views[k]!; v.root.visible = false; v.root.rotation.y = POSTS[k].face; }
}

const tmp = new THREE.Vector3();
const hm = (ms: number) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };

export function updateStaffActors(t: number) {
  for (const k of Object.keys(views) as StaffId[]) {
    const v = views[k]!, on = onDuty(k), p = POSTS[k];
    v.root.visible = on;
    if (!on) continue;
    // Standing about: a gentle sway; the manager checks a clipboard, the keeper scatters feed now and then.
    const s = Math.sin(t * 1.6 + (k === 'keeper' ? 2 : 0));
    v.root.position.set(p.x + (k === 'keeper' ? Math.sin(t * 0.4) * 0.6 : 0), 0, p.z);
    v.arms[0].rotation.set(k === 'manager' ? -1.2 : -0.4 + Math.max(0, s) * -1.2, 0, 0.15);
    v.arms[1].rotation.set(k === 'manager' ? -1.0 : 0.05 * s, 0, -0.15);
    v.head.rotation.set(k === 'manager' ? 0.25 : 0, Math.sin(t * 0.5) * 0.3, 0);
    v.basket.visible = k === 'keeper';
    lbl('staff-' + k, `${p.title} · ${hm(timeLeft(k))}`, tmp.set(v.root.position.x, 2.7, p.z), 'stafftag');
  }
}
