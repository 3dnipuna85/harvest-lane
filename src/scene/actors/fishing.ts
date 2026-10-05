import * as THREE from 'three';
import { cast, line, reel } from '../../game/fishing';
import { toast } from '../../ui/toasts';
import { ctx } from '../context';
import { lbl } from '../fx/labels';
import { splash3 } from '../fx/particles';
import { BOBBER, DOCK, riverZ } from '../layout';
import { getPlayer, goFish, isFishing, walkingToFish } from './ai';
import { Cap, Cyl, Sph, part } from './smooth';

/** The farmer's fishing rod, the line and the bobber, plus the labels that tell the player when to tap. */

let rod: THREE.Group, tip: THREE.Object3D, bobber: THREE.Group, lineMesh: THREE.Line;
const linePos = new Float32Array(9);
/** Seconds left of the reel-in pull after a catch or a miss. */
let pull = 0;
const tmp = new THREE.Vector3(), tipW = new THREE.Vector3();

export function initFishing() {
  const player = getPlayer();
  rod = new THREE.Group();
  rod.position.set(0, -0.29, 0.02);
  rod.rotation.x = 1.886;
  part(Cap(0.025, 1.5), '#9a6438', rod, 0, 0.8, 0, { ol: 0.01 });
  part(Cyl(0.06, 0.06, 0.12, 12), '#5b5b5b', rod, 0.06, 0.2, 0, { r: [0, 0, Math.PI / 2], ol: 0.008 });
  part(Cap(0.035, 0.3), '#3b2a1c', rod, 0, 0.12, 0, { ol: false });
  tip = new THREE.Object3D(); tip.position.set(0, 1.6, 0); rod.add(tip);
  rod.visible = false;
  player.v.arms[0].add(rod);

  bobber = new THREE.Group();
  part(Sph(0.11), '#e2463a', bobber, 0, 0.06, 0, { ol: 0.012 });
  part(Sph(0.1), '#ffffff', bobber, 0, -0.02, 0, { s: [1, 0.6, 1], ol: 0.012 });
  part(Cap(0.015, 0.12), '#ffffff', bobber, 0, 0.2, 0, { ol: false, shadow: false });
  bobber.visible = false;
  ctx.scene.add(bobber);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineMesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f4f1e6' }));
  lineMesh.frustumCulled = false;
  lineMesh.visible = false;
  ctx.scene.add(lineMesh);
  pull = 0;
}

/** The line jerks up out of the water: a catch or a miss. */
export function reelAnim() { pull = 0.45; }
export const bobberPos = () => new THREE.Vector3(BOBBER.x, 0.15, BOBBER.z);

export function updateFishing(dt: number, t: number) {
  const player = getPlayer(), on = isFishing(), inWater = line.state !== 'idle';
  rod.visible = on || pull > 0;
  if (on) {
    const v = player.v, bite = line.state === 'bite';
    // Both hands on the rod; it twitches while a fish nibbles and swings up when reeling in.
    const k = pull > 0 ? Math.sin((1 - pull / 0.45) * Math.PI) : 0;
    v.arms[0].rotation.set(-1.1 - k * 1.2 + (bite ? Math.sin(t * 40) * 0.08 : 0), 0, 0.15);
    v.arms[1].rotation.set(-0.95 - k * 1.0, 0, -0.35);
    v.upper.rotation.x = bite ? 0.12 : -0.05 * k;
    v.head.rotation.set(0.25, 0, 0);
  }
  if (pull > 0) pull -= dt;
  bobber.visible = inWater;
  lineMesh.visible = on && inWater;
  if (inWater) {
    const bite = line.state === 'bite';
    const dip = bite ? -0.12 + Math.sin(t * 22) * 0.06 : Math.sin(t * 3) * 0.025;
    bobber.position.set(BOBBER.x + (bite ? Math.sin(t * 17) * 0.04 : 0), 0.1 + dip, BOBBER.z);
    tip.getWorldPosition(tipW);
    linePos.set([tipW.x, tipW.y, tipW.z, (tipW.x + BOBBER.x) / 2, (tipW.y + bobber.position.y) / 2 - 0.25, (tipW.z + BOBBER.z) / 2, BOBBER.x, bobber.position.y + 0.08, BOBBER.z]);
    lineMesh.geometry.attributes.position.needsUpdate = true;
    if (bite) {
      if (Math.random() < dt * 6) splash3(BOBBER.x, BOBBER.z, 2);
      lbl('fish', '<b>❗</b> Tap now!', tmp.set(BOBBER.x, 1.4, BOBBER.z), 'fishsign bite');
    } else lbl('fish', '<span class="dots"><i></i><i></i><i></i></span>', tmp.set(BOBBER.x, 1.5, BOBBER.z), 'fishsign wait');
  } else if (on) {
    lbl('fish', '🎣 Tap the water to cast', tmp.set(BOBBER.x, 0.9, BOBBER.z), 'fishsign');
  } else if (!walkingToFish()) {
    lbl('fish', '🎣 Fish', tmp.set(DOCK.x, 1.2, riverZ(DOCK.x)), 'fishsign');
  }
}

/** Tapping the river or the dock: walk there and cast, cast again, or reel in. */
export function tapWater() {
  if (isFishing()) {
    if (line.state === 'idle') cast();
    else reel();
    return;
  }
  if (goFish() === 'busy') toast('Your farmer is busy. Tap the water again when they finish.');
}
