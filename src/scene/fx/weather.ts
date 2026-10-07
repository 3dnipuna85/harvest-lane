import * as THREE from 'three';
import { S } from '../../game/state';
import { thirsty } from '../../game/troubles';
import { ctx } from '../context';
import { plotPos } from '../layout';
import { lbl } from './labels';

/** Weather in the 3D view: rain streaks and grey light for heavy rain, hot orange light and thirsty plots for a dry spell. */

const DROPS = 700, BOX = 34;
let rain: THREE.LineSegments | null = null;
let sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight;
const base = { sun: new THREE.Color('#fff1d6'), sky: new THREE.Color('#ffffff'), ground: new THREE.Color('#8fbf5f') };
const look = {
  rain: { sun: new THREE.Color('#9fb3c8'), sky: new THREE.Color('#b9c6d6'), ground: new THREE.Color('#4f6f4a'), si: 0.22, hi: 0.4 },
  dry: { sun: new THREE.Color('#ffc27a'), sky: new THREE.Color('#fff0cf'), ground: new THREE.Color('#c9a35a'), si: 0.95, hi: 0.62 },
};
let mix = 0;
const tmp = new THREE.Vector3();

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
