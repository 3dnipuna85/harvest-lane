import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './styles.css';

import { initCloud, syncCloud } from './cloud';
import { onlineEnabled } from './online/config';
import { now } from './game/clock';
import { fillOrders } from './game/orders';
import { sim } from './game/sim';
import { load, migrate, save, setState, S, visiting } from './game/state';
import { bindInput } from './input/pointer';
import { resize } from './scene/camera';
import { initScene, renderScene, setup3D } from './scene/renderer';
import { takeDirty } from './ui/dirty';
import { $ } from './ui/format';
import { bindHud, updateHud } from './ui/hud';
import { bindGoalsUI } from './ui/goals';
import { bindPanelInput, panelSignature, renderPanel, renderTabs, updatePanel } from './ui/panel';
import { renderSeeds } from './ui/seeds';
import { toast } from './ui/toasts';
import { officeOpen, officePlace } from './ui/office';
import { inTown } from './scene/mode';
import { bindEstate } from './ui/estate';
import { bindSfx } from './ui/sfx';
import { bindTips } from './ui/tips';
import { bindGuide } from './ui/guide';
import { catchUp } from './game/staff';
import { anyAway, awayNote, warnTrouble } from './ui/staff';

let seedSig = '', panelSig = '', lastT = 0;

function frame(ts: number) {
  const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000));
  lastT = ts;
  if (!visiting) sim(dt);
  renderScene(dt, ts / 1000);
  const dirty = takeDirty();
  const ss = S.sel + S.level + S.tab + officeOpen() + officePlace() + inTown();
  if (ss !== seedSig || dirty) { renderSeeds(); renderTabs(); seedSig = ss; }
  const ps = panelSignature();
  if (ps !== panelSig || dirty) { renderPanel(); panelSig = ps; }
  updateHud();
  updatePanel();
  requestAnimationFrame(frame);
}

function start() {
  const local = load() as { saved?: number } | null;
  setState(migrate(local));
  const staffAway = catchUp(S.saved || now());
  fillOrders();
  bindHud();
  bindGoalsUI();
  bindEstate();
  bindSfx();
  bindTips();
  bindPanelInput();
  bindGuide(S.level <= 2 && S.stats.harvested < 5);
  // The Farm Office pop-up sits just above the dock, whatever height the dock wraps to.
  const docks = [...document.querySelectorAll<HTMLElement>('.dock')];
  const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', Math.max(...docks.map(d => d.offsetHeight)) + 'px'));
  docks.forEach(d => ro.observe(d));
  const has3D = setup3D($('sceneWrap'), $('overlay'));
  if (has3D) {
    bindInput();
    initScene();
    resize();
  }
  // claude.ai keeps saves in the artifact's store; the public build signs in with Firebase when configured.
  initCloud(local?.saved || 0, has3D).then(onClaude => { if (!onClaude && onlineEnabled && !('claude' in globalThis)) import('./online/login').then(m => m.initOnline()); });
  const away = (now() - (S.saved || now())) / 1000;
  if (anyAway(staffAway)) toast(awayNote(staffAway));
  else if (away > 60 && S.plots.some(p => p.crop)) toast('Welcome back. Your crops kept growing while you were away.');
  if (away > 60) warnTrouble();
  setInterval(() => { save(); syncCloud(); }, 5000);
  // A hidden tab stops drawing frames, so replay the staff's work for that time when it comes back.
  let hiddenAt = 0;
  addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = now(); save(); syncCloud(true); return; }
    if (hiddenAt && !visiting) {
      const hiddenAt0 = hiddenAt, d = catchUp(hiddenAt);
      hiddenAt = 0;
      if (anyAway(d)) toast(awayNote(d));
      if (now() - hiddenAt0 > 5 * 60_000) warnTrouble();
    }
  });
  addEventListener('pagehide', () => { save(); syncCloud(true); });
  requestAnimationFrame(ts => { lastT = ts; frame(ts); });
}

start();

// Offline support: only in production builds, so the dev server always serves fresh code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}); });
}
