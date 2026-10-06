import * as THREE from 'three';
import { now } from '../../game/clock';
import { on } from '../../game/events';
import { CHOPS, HITS, QUARRY_LVL, WOODS_LVL, chopsOn, hitsOn, rockUp, treeUp } from '../../game/resources';
import { S } from '../../game/state';
import { ctx } from '../context';
import { lbl, toScreen } from '../fx/labels';
import { fx } from '../../ui/toasts';
import { dust3 } from '../fx/particles';
import { Cyl, Sph, part } from '../geometry';
import { T } from '../materials';
import { pine } from './decor';

/** The Woods (north-west) and the Quarry (north-east), beyond the back fence. */
export const TREE_AT: [number, number][] = [[-12.2, -11.0], [-10.2, -11.4], [-8.2, -11.0], [-6.3, -11.6], [-11.4, -13.2], [-9.3, -13.5], [-7.2, -13.3], [-12.3, -15.3], [-10.2, -15.6], [-8.0, -15.4]];
export const ROCK_AT: [number, number][] = [[9.6, -11.2], [11.4, -11.0], [13.1, -11.7], [10.3, -13.3], [12.3, -13.5], [9.4, -15.1], [11.3, -15.5], [13.2, -15.2]];

interface Spot { g: THREE.Group; up: THREE.Group; down: THREE.Group; shake: number; was: boolean | null }
let trees: Spot[] = [], rocks: Spot[] = [];

function treeSpot(i: number, parent: THREE.Group): Spot {
  const [x, z] = TREE_AT[i], g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData = { type: 'tree', i };
  const up = new THREE.Group(); g.add(up);
  pine(up, 0, 0, 1.05 + (i % 3) * 0.12);
  const down = new THREE.Group(); g.add(down);
  part(Cyl(0.24, 0.28, 0.32, 14), '#9a6438', down, 0, 0.16, 0);
  part(Cyl(0.2, 0.2, 0.02, 14), '#e6c08a', down, 0, 0.33, 0, { ol: false });
  part(Sph(0.08), '#6cc04a', down, 0.18, 0.36, 0.1, { ol: 0.01 });
  parent.add(g); ctx.pickables.push(g);
  return { g, up, down, shake: 0, was: null };
}

function rockSpot(i: number, parent: THREE.Group): Spot {
  const [x, z] = ROCK_AT[i], g = new THREE.Group();
  g.position.set(x, 0, z);
  g.userData = { type: 'rock', i };
  const up = new THREE.Group(); g.add(up);
  const c = i % 2 ? '#a9a59a' : '#bdb8ab';
  part(Sph(0.62), c, up, 0, 0.36, 0, { s: [1.2, 0.85, 1] });
  part(Sph(0.38), '#9c978b', up, 0.5, 0.25, 0.25, { s: [1, 0.8, 1] });
  part(Sph(0.3), c, up, -0.45, 0.2, 0.3);
  if (i % 3 === 0) part(Sph(0.09), '#7fd3ff', up, 0.2, 0.75, 0.3, { ol: 0.01 });
  const down = new THREE.Group(); g.add(down);
  for (const [a, b] of [[-0.3, 0.1], [0.25, -0.2], [0.1, 0.3]]) part(Sph(0.14), '#9c978b', down, a, 0.08, b, { s: [1, 0.6, 1] });
  parent.add(g); ctx.pickables.push(g);
  return { g, up, down, shake: 0, was: null };
}

const tmp = new THREE.Vector3();
let bound = false;
export function buildWilds() {
  const g = new THREE.Group();
  ctx.scene.add(g);
  // forest floor and gravel pit
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), T('#5d9e3c'));
  floor.rotation.x = -Math.PI / 2; floor.position.set(-9.4, 0.01, -13.3); floor.scale.set(1, 0.8, 1); floor.receiveShadow = true; g.add(floor);
  const pit = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40), T('#cbbfa6'));
  pit.rotation.x = -Math.PI / 2; pit.position.set(11.3, 0.01, -13.3); pit.scale.set(1, 0.8, 1); pit.receiveShadow = true; g.add(pit);
  trees = TREE_AT.map((_, i) => treeSpot(i, g));
  rocks = ROCK_AT.map((_, i) => rockSpot(i, g));
  if (bound) return;
  bound = true;
  on('treeChop', ({ i }) => { if (trees[i]) { trees[i].shake = 0.35; dust3(TREE_AT[i][0], TREE_AT[i][1]); } });
  on('treeFelled', ({ i, n }) => {
    const [sx, sy] = toScreen(tmp.set(TREE_AT[i][0], 2.2, TREE_AT[i][1])); fx(sx, sy, '+' + n + ' 🪵 logs', 'gold'); for (let k = 0; k < 6; k++) dust3(TREE_AT[i][0] + (Math.random() - 0.5) * 1.5, TREE_AT[i][1] + (Math.random() - 0.5) * 1.5); });
  on('rockHit', ({ i }) => { if (rocks[i]) { rocks[i].shake = 0.3; dust3(ROCK_AT[i][0], ROCK_AT[i][1]); } });
  on('rockBroken', ({ i, n }) => {
    const [sx, sy] = toScreen(tmp.set(ROCK_AT[i][0], 1.4, ROCK_AT[i][1])); fx(sx, sy, '+' + n + ' 🪨 stone', 'gold'); for (let k = 0; k < 6; k++) dust3(ROCK_AT[i][0] + (Math.random() - 0.5) * 1.2, ROCK_AT[i][1] + (Math.random() - 0.5) * 1.2); });
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function sync(list: Spot[], isUp: (i: number) => boolean, back: number[], done: (i: number) => number, need: number, dt: number) {
  const t = now();
  list.forEach((s, i) => {
    const up = isUp(i);
    if (s.was !== up) { s.up.visible = up; s.down.visible = !up; s.was = up; }
    if (s.shake > 0) { s.shake -= dt; s.up.rotation.z = Math.sin(s.shake * 60) * 0.06; } else s.up.rotation.z = 0;
    // chopped trees and cracked rocks lean and shrink a little with each blow
    const d = done(i);
    s.up.scale.setScalar(1 - d * 0.06);
    if (d) lbl('wild' + list.length + i, '●'.repeat(d) + '○'.repeat(need - d), tmp.set(s.g.position.x, 2.6, s.g.position.z), 'timer');
    else if (!up && (back[i] || 0) - t < 60_000) lbl('wild' + list.length + i, mmss((back[i] || 0) - t), tmp.set(s.g.position.x, 0.9, s.g.position.z), 'timer');
  });
}

export function updateWilds(dt: number) {
  sync(trees, i => treeUp(i), S.woods, chopsOn, CHOPS, dt);
  sync(rocks, i => rockUp(i), S.rocks, hitsOn, HITS, dt);
  lbl('woodsign', S.level < WOODS_LVL ? `<b>🌲 Woods</b><span>Opens at level ${WOODS_LVL}</span>` : '<b>🌲 Woods</b><span>Tap a tree to chop</span>', tmp.set(-9.4, 2.2, -10.0), 'townsign');
  lbl('quarrysign', S.level < QUARRY_LVL ? `<b>⛏️ Quarry</b><span>Opens at level ${QUARRY_LVL}</span>` : '<b>⛏️ Quarry</b><span>Tap a rock to mine</span>', tmp.set(11.3, 2.2, -10.0), 'townsign');
}
