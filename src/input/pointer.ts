import * as THREE from 'three';
import { buyLand, buyPlot, loadTruck, tapAnimal } from '../ui/actions';
import { save, visiting, type Tab } from '../game/state';
import { isFishing, tapPlot } from '../scene/actors/ai';
import { line } from '../game/fishing';
import { applyCam, cancelFocus, focusOn, getZoom, pan, setZoom, view } from '../scene/camera';
import { tapWater } from '../scene/actors/fishing';
import { FISH_SPOT } from '../scene/layout';
import { ctx } from '../scene/context';
import { $ } from '../ui/format';
import { openOffice } from '../ui/office';
import { inTown } from '../scene/mode';
import { applyTownCam, setTownZoom, town, townView, type Place } from '../scene/town/town';
import { goFarm, goTown, serviceInfo, visitPlace } from '../ui/town';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

function openTab(t: Tab) { openOffice(t); }

/** Raycast a tap and route it to whatever was hit. */
function pick(cx: number, cy: number) {
  if (visiting) return;
  const r = ctx.cvs.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
  const away = inTown();
  ray.setFromCamera(ndc, away ? town.camera : ctx.camera);
  const hits = ray.intersectObjects(away ? town.pickables : ctx.pickables, true);
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o && !o.userData.type) o = o.parent;
    if (!o) continue;
    const u = o.userData;
    if (u.type === 'plot') { tapPlot(u.i); $('hint').classList.add('gone'); save(); return; }
    if (u.type === 'buy') { if (o.visible) { buyPlot(); save(); } return; }
    if (u.type === 'bld') { openTab(u.id === 'barn' ? 'barn' : 'machines'); return; }
    if (u.type === 'cart') { openTab('helpers'); return; }
    if (u.type === 'animal') { tapAnimal(u.kind, u.i); $('hint').classList.add('gone'); save(); return; }
    if (u.type === 'place') { visitPlace(u.k as Place); return; }
    if (u.type === 'info') { serviceInfo(u.k); return; }
    if (u.type === 'town') { goTown(); return; }
    if (u.type === 'land') { buyLand(); save(); return; }
    if (u.type === 'river') { tapWater(); $('hint').classList.add('gone'); save(); return; }
    if (u.type === 'truck') { if (!loadTruck(cx, cy)) openTab('orders'); save(); return; }
  }
  if (away) return;
  // With a line in the water, a tap anywhere else reels in, so a bite is never lost to a near miss.
  if (isFishing() && line.state !== 'idle') tapWater();
}

/** Tap vs drag, one-finger pan, two-finger pinch, mouse wheel and the +/- buttons. */
export function bindInput() {
  const cvs = ctx.cvs;
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  let pd: { x: number; y: number; px: number; py: number; drag: boolean } | null = null;

  cvs.addEventListener('pointerdown', e => {
    cancelFocus();
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: inTown() ? townView.Z : getZoom() };
      pd = null;
      return;
    }
    pd = inTown() ? { x: e.clientX, y: e.clientY, px: townView.px, py: townView.py, drag: false } : { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, drag: false };
  });
  const zoomBy = (f: number) => (inTown() ? setTownZoom(townView.Z * f) : setZoom(getZoom() * f));
  cvs.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const z = (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.d);
      if (inTown()) setTownZoom(z); else setZoom(z);
      return;
    }
    if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (!pd.drag && Math.hypot(dx, dy) > 8) pd.drag = true;
    if (pd.drag && inTown()) {
      townView.px = pd.px - dx * ((2 * townView.hw) / ctx.CW);
      townView.py = pd.py + dy * ((2 * townView.hh) / ctx.CH);
      applyTownCam();
    } else if (pd.drag) {
      pan.x = pd.px - dx * ((2 * view.hw) / ctx.CW);
      pan.y = pd.py + dy * ((2 * view.hh) / ctx.CH);
      applyCam();
    }
  });
  addEventListener('pointerup', e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (!pd) return;
    const was = pd;
    pd = null;
    if (!was.drag && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 10) pick(e.clientX, e.clientY);
  });
  addEventListener('pointercancel', e => { pd = null; touches.delete(e.pointerId); pinch = null; });
  $('fishBtn').addEventListener('click', () => { focusOn(FISH_SPOT.x + 1, FISH_SPOT.z - 1); tapWater(); });
  // The fishing labels over the water are tappable too.
  ctx.overlay.addEventListener('click', e => {
    const el = e.target as HTMLElement;
    if (el.closest('.fishsign')) { tapWater(); save(); }
    else if (el.closest('.lbl.land')) { buyLand(); save(); }
    else {
      const sign = el.closest('.lbl.townsign');
      const k = sign && [...sign.classList].find(c => c.startsWith('p-'))?.slice(2);
      if (k === 'town') goTown();
      else if (k === 'farm') goFarm();
      else if (k?.startsWith('info-')) serviceInfo(k.slice(5));
      else if (k) visitPlace(k as Place);
    }
  });
  $('zin').addEventListener('click', () => zoomBy(1.2));
  $('zout').addEventListener('click', () => zoomBy(1 / 1.2));
}
