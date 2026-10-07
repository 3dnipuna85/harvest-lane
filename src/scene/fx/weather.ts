import * as THREE from 'three';
import { S } from '../../game/state';
import { thirsty } from '../../game/troubles';
import { emit } from '../../game/events';
import { ctx } from '../context';
import { plotPos } from '../layout';
import { lbl } from './labels';

/** Weather in the 3D view: rain streaks and grey light for heavy rain, hot orange light and thirsty plots for a dry spell. */

const DROPS = 1300, BOX = 34;
let rain: THREE.LineSegments | null = null;
let sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight;
const base = { sun: new THREE.Color('#fff1d6'), sky: new THREE.Color('#ffffff'), ground: new THREE.Color('#8fbf5f') };
const look = {
  rain: { sun: new THREE.Color('#8798ad'), sky: new THREE.Color('#8e9db0'), ground: new THREE.Color('#3c5638'), si: 0.14, hi: 0.3 },
  dry: { sun: new THREE.Color('#ffc27a'), sky: new THREE.Color('#fff0cf'), ground: new THREE.Color('#c9a35a'), si: 0.95, hi: 0.62 },
};
let mix = 0;
const tmp = new THREE.Vector3();
/** Lightning: when the next strike comes (s), how bright the flash is now, and the bolt. */
// Timed in real seconds: frame dt is capped, so slow devices would otherwise get far fewer strikes.
let nextBolt = 0, flash = 0, flashT = 0;
let bolt: THREE.Line | null = null;
const flashCol = new THREE.Color('#e6eeff');

/** A jagged bolt from the clouds to a spot on the ground. */
function makeBolt(x: number, z: number) {
  const pts: THREE.Vector3[] = [];
  let px = x + (Math.random() - 0.5) * 4, pz = z + (Math.random() - 0.5) * 4;
  for (let y = 22; y > 0; y -= 1.6) {
    pts.push(new THREE.Vector3(px, y, pz));
    px += (x - px) * 0.25 + (Math.random() - 0.5) * 1.4;
    pz += (z - pz) * 0.25 + (Math.random() - 0.5) * 1.4;
  }
  pts.push(new THREE.Vector3(x, 0, z));
  bolt!.geometry.dispose();
  bolt!.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

export function initWeather(s: THREE.DirectionalLight, h: THREE.HemisphereLight) {
  sun = s; hemi = h; mix = 0;
  const pos = new Float32Array(DROPS * 6);
  for (let k = 0; k < DROPS; k++) {
    const x = (Math.random() - 0.5) * BOX, y = Math.random() * 14, z = (Math.random() - 0.5) * BOX;
    pos.set([x, y, z, x + 0.08, y - 0.55, z + 0.05], k * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.7 }));
  rain.visible = false;
  rain.frustumCulled = false;
  ctx.scene.add(rain);
  bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f4f8ff', transparent: true, opacity: 0 }));
  bolt.frustumCulled = false;
  bolt.visible = false;
  ctx.scene.add(bolt);
  nextBolt = 0;
}

export function updateWeather(dt: number) {
  if (!rain) return;
  const kind = S.trouble?.kind, wx = kind === 'rain' || kind === 'dry' ? look[kind] : null;
  mix = Math.max(0, Math.min(1, mix + (wx ? dt : -dt) * 0.8));
  const l = wx ?? look.rain;
  sun.color.copy(base.sun).lerp(l.sun, mix);
  hemi.color.copy(base.sky).lerp(l.sky, mix);
  hemi.groundColor.copy(base.ground).lerp(l.ground, mix);
  sun.intensity = 0.72 + (l.si - 0.72) * mix;
  hemi.intensity = 0.62 + (l.hi - 0.62) * mix;
  // Lightning during heavy rain: a bright double flicker, a bolt, and thunder (ui/sfx.ts) after a delay.
  if (kind === 'rain' && mix > 0.6) {
    const t = performance.now() / 1000;
    if (!nextBolt) nextBolt = t + 3;
    if (t >= nextBolt) {
      nextBolt = t + 5 + Math.random() * 9;
      const near = Math.random();
      flash = 1; flashT = 0;
      const ang = Math.random() * Math.PI * 2, r = 6 + (1 - near) * 14;
      makeBolt(Math.cos(ang) * r, Math.sin(ang) * r);
      emit('lightning', { near });
    }
  }
  else nextBolt = 0;
  if (flash > 0) {
    flashT += Math.min(dt, 0.1);
    // on, off, brighter on, then fade
    const f = flashT < 0.07 ? 1 : flashT < 0.13 ? 0.15 : flashT < 0.22 ? 1.2 : Math.max(0, 1.2 - (flashT - 0.22) * 4);
    if (flashT > 0.6) flash = 0;
    sun.color.lerp(flashCol, Math.min(1, f));
    hemi.color.lerp(flashCol, Math.min(1, f));
    sun.intensity += 1.6 * f; hemi.intensity += 1.1 * f;
    bolt!.visible = f > 0.05;
    (bolt!.material as THREE.LineBasicMaterial).opacity = Math.min(1, f);
  } else if (bolt) bolt.visible = false;
  rain.visible = kind === 'rain' || (mix > 0.05 && !wx);
  (rain.material as THREE.LineBasicMaterial).opacity = 0.7 * mix;
  if (rain.visible) {
    const a = rain.geometry.getAttribute('position') as THREE.BufferAttribute, p = a.array as Float32Array;
    for (let k = 0; k < DROPS; k++) {
      const o = k * 6;
      let y = p[o + 1] - dt * 16;
      if (y < 0) y += 14;
      p[o + 1] = y; p[o + 4] = y - 0.55;
    }
    a.needsUpdate = true;
  }
  if (kind === 'dry') S.plots.forEach((_, i) => { if (thirsty(i)) { const q = plotPos(i); lbl('thirst' + i, '💧', tmp.set(q.x, 1.1, q.z), 'thirst'); } });
}
