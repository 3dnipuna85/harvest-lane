import * as THREE from 'three';
import { buyPlot, loadTruck, tapAnimal } from '../ui/actions';
import { save, type Tab } from '../game/state';
import { tapPlot } from '../scene/actors/ai';
import { applyCam, getZoom, pan, setZoom, view } from '../scene/camera';
import { ctx } from '../scene/context';
import { $ } from '../ui/format';
import { openOffice } from '../ui/office';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

function openTab(t: Tab) { openOffice(t); }

/** Raycast a tap and route it to whatever was hit. */
function pick(cx: number, cy: number) {
  const r = ctx.cvs.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
  ray.setFromCamera(ndc, ctx.camera);
  const hits = ray.intersectObjects(ctx.pickables, true);
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
    if (u.type === 'truck') { if (!loadTruck(cx, cy)) openTab('orders'); save(); return; }
  }
}

/** Tap vs drag, one-finger pan, two-finger pinch, mouse wheel and the +/- buttons. */
export function bindInput() {
  const cvs = ctx.cvs;
  const touches = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  let pd: { x: number; y: number; px: number; py: number; drag: boolean } | null = null;

  cvs.addEventListener('pointerdown', e => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: getZoom() };
      pd = null;
      return;
    }
    pd = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, drag: false };
  });
  cvs.addEventListener('wheel', e => { e.preventDefault(); setZoom(getZoom() * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
  addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      setZoom((pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.d));
      return;
    }
    if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (!pd.drag && Math.hypot(dx, dy) > 8) pd.drag = true;
    if (pd.drag) {
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
  $('zin').addEventListener('click', () => setZoom(getZoom() * 1.2));
  $('zout').addEventListener('click', () => setZoom(getZoom() / 1.2));
}
