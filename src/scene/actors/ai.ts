import * as THREE from 'three';
import { CROPS, type CropId } from '../../data/crops';
import { MAX_QUEUE } from '../../data/limits';
import { byStaff, harvest, plant, ripe } from '../../game/economy';
import { now } from '../../game/clock';
import { S, visiting } from '../../game/state';
import { handSeed, onDuty, timeLeft, unpaid } from '../../game/staff';
import { fx, shakeScene, toast } from '../../ui/toasts';
import { CARTP, FISH_SPOT, PITCH, ROADZ, plotPos } from '../layout';
import { cast, stopFishing } from '../../game/fishing';
import { lbl, toScreen } from '../fx/labels';
import { mkChar, poseChar, removeChar, type Char } from './person';

/** Plots the player tapped, in order. The farmer works through them one by one. */
let queue: { i: number; crop: CropId }[] = [];
/** Plot index -> id of the character walking to or working on it. */
const res = new Map<number, string>();
let player: Char;
let hands: Char[] = [];
let sellers: Char[] = [];
/** The paid farm manager, walking the field while on duty. */
let manager: Char | null = null;
let saleTurn = 0;
/** True while the farmer stands at the end of the dock with a rod. */
let fishing = false;
export const isFishing = () => fishing;

/** The player's farmer, for followers like the dog. */
export const getPlayer = () => player;

export function initActors() {
  queue = []; res.clear(); hands = []; sellers = []; manager = null; saleTurn = 0; fishing = false; stopFishing();
  player = mkChar('player', 0);
  player.x = 0; player.z = ROADZ; player.face = Math.PI / 4;
}

const inQueue = (i: number) => queue.some(q => q.i === i);
const isBusy = (i: number) => res.has(i) || inQueue(i);
/** True when the player has this plot queued or is walking to it (drawn as a white frame). */
export const isQueued = (i: number) => inQueue(i) || !!(player.task && player.task.i === i && player.state === 'walk');

/** A farmhand's next job: a ripe plot first, otherwise an empty plot if the selected seed is affordable. */
function pickJob() {
  // With a manager on duty, ripe crops a truck is waiting on come first.
  const want = S.truck ? S.plots.findIndex((p, j) => ripe(p) && !isBusy(j) && !!S.truck!.items[p.crop!]) : -1;
  if (want >= 0 && onDuty('manager')) return want;
  let i = S.plots.findIndex((p, j) => ripe(p) && !isBusy(j));
  if (i >= 0) return i;
  const seed = handSeed();
  if (seed && S.coins >= CROPS[seed].seed) { i = S.plots.findIndex((p, j) => !p.crop && !isBusy(j)); if (i >= 0) return i; }
  return -1;
}

/** Column paths run between plot columns, row paths in front of each plot row. */
const colGap = (x: number) => (Math.round(x / PITCH - 0.5) + 0.5) * PITCH;
const onColGap = (x: number) => Math.abs(x - colGap(x)) < 0.2;
/** Which field a point is in: the home field inside the fence (0), or the land east (1) or west (-1) of it. */
const zone = (x: number) => (x > 13 ? 1 : x < -13 ? -1 : 0);

function goTo(c: Char, i: number, crop: CropId = S.sel) {
  // Work from the path beside the plot, never standing in the soil: the farmer at the front edge
  // (down-screen), a farmhand on the right-hand edge. Walks stick to the paths between plots.
  const q = plotPos(i), gx = q.x + (c.kind === 'hand' ? PITCH / 2 : -PITCH / 2), gz = q.z + PITCH / 2;
  const end = c.kind === 'hand' ? { x: gx, z: q.z + 0.35 } : { x: q.x - 0.2, z: gz };
  let pts: { x: number; z: number }[];
  if (zone(c.x) !== zone(q.x)) {
    // To another field: up the nearest column path to the road, along it, then down into the other field.
    const cx = onColGap(c.x) ? c.x : colGap(c.x);
    pts = [{ x: cx, z: c.z }, { x: cx, z: ROADZ }, { x: gx, z: ROADZ }, { x: gx, z: c.kind === 'hand' ? end.z : gz }, end];
  } else pts = onColGap(c.x)
    ? [{ x: c.x, z: gz }, { x: gx, z: gz }, end]
    : [{ x: gx, z: c.z }, { x: gx, z: c.kind === 'hand' ? end.z : gz }, end];
  const first = pts.shift()!;
  c.tx = first.x; c.tz = first.z; c.path = pts;
  c.task = { i, crop };
  c.state = 'walk';
  res.set(i, c.id);
}

function startWork(c: Char) {
  const p = S.plots[c.task!.i];
  const type = !p ? null : !p.crop ? 'plant' : ripe(p) ? 'harvest' : null;
  if (!type) { finish(c); return; }
  c.state = 'work'; c.act = 0; c.done = false; c.actType = type;
  // Turn to face the plot from the path.
  const q = plotPos(c.task!.i);
  c.face = Math.atan2(q.x - c.x, q.z - c.z);
  c.actDur = c.kind === 'player' ? (type === 'plant' ? 0.8 : 0.7) : (type === 'plant' ? 0.95 : 0.8);
}

function finish(c: Char) {
  if (c.task && res.get(c.task.i) === c.id) res.delete(c.task.i);
  c.task = null; c.state = 'idle'; c.idleT = 0.2 + Math.random() * 0.3;
  if (c.kind !== 'seller') c.face = Math.PI / 4;
}

function seedDenied(crop: CropId = S.sel) {
  const c = CROPS[crop];
  toast('You need ' + c.seed + ' coins for ' + c.name + ' seeds');
  shakeScene();
}

function updateChar(c: Char, dt: number) {
  if (c.state === 'idle') {
    if (c.kind === 'player') { const q = queue.shift(); if (q && S.plots[q.i]) { leaveWater(); goTo(c, q.i, q.crop); } }
    else if ((c.kind === 'manager' || (c.kind === 'hand' && !unpaid)) && !visiting) { c.idleT -= dt; if (c.idleT <= 0) { const i = pickJob(); if (i >= 0) goTo(c, i, handSeed() ?? S.sel); else c.idleT = 0.6; } }
  }
  if (c.state === 'walk') {
    const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz), step = c.speed * dt;
    if (d > 0.01) c.face = Math.atan2(dx, dz);
    if (d <= step) {
      c.x = c.tx; c.z = c.tz;
      const nx = c.path.shift();
      if (nx) { c.tx = nx.x; c.tz = nx.z; }
      else if (c.onArrive) { const f = c.onArrive; c.onArrive = undefined; c.state = 'idle'; f(); }
      else startWork(c);
    }
    else { c.x += (dx / d) * step; c.z += (dz / d) * step; c.phase += dt * (c.kind === 'player' ? 15 : 11); }
  } else if (c.state === 'work') {
    c.act += dt;
    // The plant or harvest happens partway through the swing.
    if (!c.done && c.act >= c.actDur * 0.6) {
      c.done = true;
      const { i, crop } = c.task!, p = S.plots[i];
      if (c.actType === 'plant' && p && !p.crop) { if (c.kind === 'player') { if (!plant(i, crop)) seedDenied(crop); } else byStaff(() => plant(i, crop)); }
      // only the player's own harvests earn XP
      else if (c.actType === 'harvest' && p && ripe(p)) { if (c.kind === 'player') harvest(i); else byStaff(() => harvest(i)); }
    }
    if (c.act >= c.actDur) finish(c);
  }
  if (c.wave > 0) c.wave -= dt;
}

/** Match the number of farmhand and seller figures to the hired counts. */
export function syncCrew() {
  while (hands.length < S.farmhands) hands.push(mkChar('hand', hands.length));
  while (hands.length > S.farmhands) {
    const h = hands.pop()!;
    if (h.task && res.get(h.task.i) === h.id) res.delete(h.task.i);
    removeChar(h);
  }
  while (sellers.length < S.sellers) sellers.push(mkChar('seller', sellers.length));
  while (sellers.length > S.sellers) removeChar(sellers.pop()!);
  const duty = onDuty('manager') && !visiting;
  if (duty && !manager) { manager = mkChar('manager', 0); manager.x = 3.4; manager.z = ROADZ + 1; }
  if (!duty && manager) {
    if (manager.task && res.get(manager.task.i) === manager.id) res.delete(manager.task.i);
    removeChar(manager); manager = null;
  }
  sellers.forEach((s, j) => { s.x = CARTP.x - 1.35 - j * 0.6; s.z = CARTP.z + 0.3 + (j % 2) * 0.3; s.face = Math.PI / 6; });
}

/** The next seller in turn waves when a sale happens. */
export function sellerWave() {
  const who = sellers[saleTurn++ % Math.max(1, sellers.length)];
  if (who) who.wave = 0.8;
}

const tmp = new THREE.Vector3();
export function updateActors(dt: number, t: number) {
  updateChar(player, dt);
  hands.forEach(h => updateChar(h, dt));
  if (manager) updateChar(manager, dt);
  sellers.forEach(s => updateChar(s, dt));
  poseChar(player, t);
  hands.forEach(h => poseChar(h, t));
  if (manager) {
    poseChar(manager, t);
    const m = Math.ceil(timeLeft('manager') / 60000), tl = m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
    const doing = manager.task && S.truck?.items[S.plots[manager.task.i]?.crop ?? ('' as never)] ? ' · for the truck 🚚' : '';
    lbl('mgr', 'Manager · ' + tl + doing, tmp.set(manager.x, 2.7, manager.z), 'stafftag');
  }
  sellers.forEach(s => poseChar(s, t));
  if (queue.length) lbl('q', String(queue.length + (player.task ? 1 : 0)), tmp.set(player.x, 2.5, player.z), 'q');
}

/** Player tapped plot i: queue a plant or harvest, or show the time left on a growing crop. */
export function tapPlot(i: number) {
  const p = S.plots[i];
  if (p.crop && !ripe(p)) {
    const q = plotPos(i), [sx, sy] = toScreen(tmp.set(q.x, 1, q.z));
    fx(sx, sy, Math.ceil(CROPS[p.crop].time - (now() - p.at) / 1000) + 's left', '');
    return;
  }
  if (inQueue(i) || (player.task && player.task.i === i)) return;
  if (!p.crop && S.coins < CROPS[S.sel].seed) { seedDenied(); return; }
  if (queue.length >= MAX_QUEUE) return;
  // Remember the seed selected right now, so changing the selection later never changes this plot.
  queue.push({ i, crop: S.sel });
}

function leaveWater() {
  if (!fishing) return;
  fishing = false;
  stopFishing();
}

/** Send the farmer down the path between the plot columns, through the gate, to the end of the dock. Casts on arrival. */
export function goFish(): 'walking' | 'there' | 'busy' {
  if (fishing) return 'there';
  if (player.state !== 'idle' || player.task || queue.length) return 'busy';
  if (zone(player.x) !== 0) {
    // From the land outside the fence, come back along the road first.
    const cx = onColGap(player.x) ? player.x : colGap(player.x);
    player.tx = cx; player.tz = player.z;
    player.path = [{ x: cx, z: ROADZ }, { x: FISH_SPOT.x, z: ROADZ }, { x: FISH_SPOT.x, z: FISH_SPOT.z }];
  } else {
    player.tx = FISH_SPOT.x; player.tz = player.z;
    player.path = [{ x: FISH_SPOT.x, z: FISH_SPOT.z }];
  }
  player.state = 'walk';
  player.onArrive = () => { fishing = true; player.face = 0; cast(); };
  return 'walking';
}

/** True while the farmer is on the way to the dock. */
export const walkingToFish = () => player.state === 'walk' && !!player.onArrive;
