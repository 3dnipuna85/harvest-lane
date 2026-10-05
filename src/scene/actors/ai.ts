import * as THREE from 'three';
import { CROPS } from '../../data/crops';
import { MAX_QUEUE } from '../../data/limits';
import { harvest, plant, ripe } from '../../game/economy';
import { now } from '../../game/clock';
import { S } from '../../game/state';
import { fx, shakeScene, toast } from '../../ui/toasts';
import { CARTP, ROADZ, plotPos } from '../layout';
import { lbl, toScreen } from '../fx/labels';
import { mkChar, poseChar, removeChar, type Char } from './person';

/** Plots the player tapped, in order. The farmer works through them one by one. */
let queue: number[] = [];
/** Plot index -> id of the character walking to or working on it. */
const res = new Map<number, string>();
let player: Char;
let hands: Char[] = [];
let sellers: Char[] = [];
let saleTurn = 0;

export function initActors() {
  queue = []; res.clear(); hands = []; sellers = []; saleTurn = 0;
  player = mkChar('player', 0);
  player.x = 0; player.z = ROADZ; player.face = Math.PI / 4;
}

const isBusy = (i: number) => res.has(i) || queue.includes(i);
/** True when the player has this plot queued or is walking to it (drawn as a white frame). */
export const isQueued = (i: number) => queue.includes(i) || !!(player.task && player.task.i === i && player.state === 'walk');

/** A farmhand's next job: a ripe plot first, otherwise an empty plot if the selected seed is affordable. */
function pickJob() {
  let i = S.plots.findIndex((p, j) => ripe(p) && !isBusy(j));
  if (i >= 0) return i;
  if (S.coins >= CROPS[S.sel].seed) { i = S.plots.findIndex((p, j) => !p.crop && !isBusy(j)); if (i >= 0) return i; }
  return -1;
}

function goTo(c: Char, i: number) {
  const q = plotPos(i);
  c.tx = q.x + (c.kind === 'hand' ? -0.4 : 0);
  c.tz = q.z + 0.15;
  c.task = { i };
  c.state = 'walk';
  res.set(i, c.id);
}

function startWork(c: Char) {
  const p = S.plots[c.task!.i];
  const type = !p ? null : !p.crop ? 'plant' : ripe(p) ? 'harvest' : null;
  if (!type) { finish(c); return; }
  c.state = 'work'; c.act = 0; c.done = false; c.actType = type; c.face = Math.PI / 4;
  c.actDur = c.kind === 'player' ? (type === 'plant' ? 0.55 : 0.45) : (type === 'plant' ? 0.95 : 0.8);
}

function finish(c: Char) {
  if (c.task && res.get(c.task.i) === c.id) res.delete(c.task.i);
  c.task = null; c.state = 'idle'; c.idleT = 0.2 + Math.random() * 0.3;
  if (c.kind !== 'seller') c.face = Math.PI / 4;
}

function seedDenied() {
  const c = CROPS[S.sel];
  toast('You need ' + c.seed + ' coins for ' + c.name + ' seeds');
  shakeScene();
}

function updateChar(c: Char, dt: number) {
  if (c.state === 'idle') {
    if (c.kind === 'player') { const i = queue.shift(); if (i != null && S.plots[i]) goTo(c, i); }
    else if (c.kind === 'hand') { c.idleT -= dt; if (c.idleT <= 0) { const i = pickJob(); if (i >= 0) goTo(c, i); else c.idleT = 0.6; } }
  }
  if (c.state === 'walk') {
    const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz), step = c.speed * dt;
    if (d > 0.01) c.face = Math.atan2(dx, dz);
    if (d <= step) { c.x = c.tx; c.z = c.tz; startWork(c); }
    else { c.x += (dx / d) * step; c.z += (dz / d) * step; c.phase += dt * (c.kind === 'player' ? 15 : 11); }
  } else if (c.state === 'work') {
    c.act += dt;
    // The plant or harvest happens partway through the swing.
    if (!c.done && c.act >= c.actDur * 0.6) {
      c.done = true;
      const i = c.task!.i, p = S.plots[i];
      if (c.actType === 'plant' && p && !p.crop) { if (!plant(i) && c.kind === 'player') seedDenied(); }
      else if (c.actType === 'harvest' && p && ripe(p)) harvest(i);
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
  sellers.forEach((s, j) => { s.x = CARTP.x - 1.35 - j * 0.6; s.z = CARTP.z + 0.5 + (j % 2) * 0.3; s.face = Math.PI / 4; });
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
  sellers.forEach(s => updateChar(s, dt));
  poseChar(player, t);
  hands.forEach(h => poseChar(h, t));
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
  if (queue.includes(i) || (player.task && player.task.i === i)) return;
  if (!p.crop && S.coins < CROPS[S.sel].seed) { seedDenied(); return; }
  if (queue.length >= MAX_QUEUE) return;
  queue.push(i);
}
