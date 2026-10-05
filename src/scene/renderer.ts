import * as THREE from 'three';
import { CROPS } from '../data/crops';
import { GOODS } from '../data/goods';
import { on } from '../game/events';
import { fmt } from '../ui/format';
import { fx } from '../ui/toasts';
import { initActors, sellerWave, syncCrew, updateActors } from './actors/ai';
import { initAnimals, updateAnimals } from './actors/animals';
import { computeFull, resize } from './camera';
import { ctx } from './context';
import { resetFlyers, spawnFly, updateFlies } from './fx/flyers';
import { beginLabels, clearLabels, endLabels, toScreen } from './fx/labels';
import { dust3, resetParticles, updatePuffs } from './fx/particles';
import { CARTP, barnDoor, plotPos } from './layout';
import { buildBarn, updateBarn } from './world/barn';
import { initPlots, syncPlots, updatePlots } from './world/plots';
import { buildCart, buildWorld, updateCart } from './world/props';
import { initWorkshops, syncBuildings, updateBuildings, workshopDoor } from './world/workshops';

function note(msg: string) {
  ctx.wrap.insertAdjacentHTML('beforeend', `<div class="scene-note">${msg}</div>`);
}

/** Create the WebGL renderer and camera. Returns false if WebGL is unavailable. */
export function setup3D(wrap: HTMLElement, overlay: HTMLElement): boolean {
  ctx.wrap = wrap;
  ctx.overlay = overlay;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    ctx.ok3d = false;
    note('The 3D farm needs WebGL, which this browser has turned off.');
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cvs = renderer.domElement;
  cvs.setAttribute('aria-label', '3D farm with plots, buildings and workers');
  wrap.insertBefore(cvs, overlay);
  ctx.renderer = renderer;
  ctx.cvs = cvs;
  ctx.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  computeFull();
  new ResizeObserver(() => resize()).observe(wrap);
  bindSceneEvents();
  return true;
}

/** Build (or rebuild, after starting a new farm) everything in the scene. */
export function initScene() {
  if (!ctx.ok3d) return;
  const scene = (ctx.scene = new THREE.Scene());
  ctx.pickables.length = 0;
  resetParticles(); resetFlyers(); clearLabels();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fbf5f', 0.62));
  const sun = new THREE.DirectionalLight('#fff1d6', 0.72);
  sun.position.set(-9, 20, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 60 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  scene.add(sun);
  buildWorld();
  buildBarn();
  initWorkshops();
  buildCart();
  initPlots();
  initActors();
  initAnimals();
  syncPlots();
  syncBuildings();
}

/** Advance animations and draw one frame. */
export function renderScene(dt: number, t: number) {
  if (!ctx.ok3d) return;
  beginLabels();
  syncPlots(); syncBuildings(); syncCrew();
  updateActors(dt, t);
  updateAnimals(dt, t);
  updatePlots(t, dt);
  updateBuildings(dt);
  updateBarn();
  updateCart();
  updatePuffs(dt);
  updateFlies(dt);
  endLabels();
  ctx.renderer.render(ctx.scene, ctx.camera);
}

/** Turn game events into visual feedback. */
function bindSceneEvents() {
  on('plant', ({ i }) => {
    const q = plotPos(i);
    for (let k = 0; k < 7; k++) dust3(q.x + (Math.random() - 0.5) * 1.6, q.z + (Math.random() - 0.5) * 1.4);
  });
  on('harvest', ({ i, crop, n }) => {
    const q = plotPos(i), c = CROPS[crop];
    for (let k = 0; k < n; k++) spawnFly(c.icon, new THREE.Vector3(q.x, 0.8, q.z), barnDoor(), k * 0.12);
    const [sx, sy] = toScreen(new THREE.Vector3(q.x, 1.4, q.z));
    fx(sx, sy, '+' + n + ' ' + c.icon + (n > 1 ? ' bonus!' : ''), 'green');
  });
  on('machineDone', ({ id, out }) => spawnFly(GOODS[out].icon, workshopDoor(id), barnDoor(), 0));
  on('sellerSale', ({ coins }) => {
    sellerWave();
    const [sx, sy] = toScreen(new THREE.Vector3(CARTP.x, 2.2, CARTP.z));
    fx(sx, sy, '+' + fmt(coins), 'gold');
  });
}
